import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import env from "../config/env";
import { prisma } from "../lib/prisma";
import * as transportService from "./transportService";
import { TRANSPORT_FLIGHT_PARSING_SYSTEM_PROMPT } from "../prompts/system/transport/flightParsing";

import {
  buildHistoryMessages,
  getLatestPendingAction,
  parseAssistantPayload,
} from "../ai/transportChatMemory";
import { buildCleanRequests, parseLLMJson } from "../ai/transportChatParsing";
import {
  describeFlight,
  summarizeFlightOptions,
} from "../mappers/flightDescribeMapper";

import {
  fetchFlightScheduleCandidates,
  type ResolvedFlight,
} from "../integrations/aeroApiFlightCandidates";

import { resolveMemberIdsFromNames } from "../auth/resolveMemberIdsFromNames";

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

type PendingAction =
  | {
      type: "create-flight";
      flight: ResolvedFlight;
      memberIds: string[];
      options?: ResolvedFlight[];
    }
  | {
      type: "choose-flight";
      options: ResolvedFlight[];
      memberIds: string[];
    };

export type AssistantPayload = {
  message: string;
  status: "clarify" | "confirm" | "created" | "error";
  pendingAction?: PendingAction | null;
  options?: ResolvedFlight[];
  createdItemId?: string;
};

function toPayload(p: AssistantPayload): AssistantPayload {
  return {
    pendingAction: null,
    options: undefined,
    createdItemId: undefined,
    ...p,
  };
}

/* ------------------------------------------------------------------ */

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

const MODEL_PREFIX = "flight-chat";
const HISTORY_LIMIT = 10;

const yesNo = {
  yes: ["yes", "yep", "sure", "confirm", "yeah", "yup"],
  no: ["no", "nah", "nope", "cancel", "stop"],
};

const systemPrompt = TRANSPORT_FLIGHT_PARSING_SYSTEM_PROMPT;

/* ------------------------------------------------------------------ */
/* Public API */
/* ------------------------------------------------------------------ */

export const transportChatService = {
  async getHistory({ userId, groupId }: { userId: string; groupId: string }) {
    const sessions = await prisma.aiSession.findMany({
      where: { userId, model: `${MODEL_PREFIX}:${groupId}` },
      orderBy: { createdAt: "asc" },
      take: HISTORY_LIMIT,
    });

    return sessions.flatMap((session) => {
      const parsed = parseAssistantPayload(session.response);
      const assistantMessage = parsed?.message ?? session.response ?? "…";

      return [
        {
          id: `${session.id}-user`,
          role: "user" as const,
          message: session.prompt,
          createdAt: session.createdAt,
        },
        {
          id: `${session.id}-assistant`,
          role: "assistant" as const,
          message: assistantMessage,
          createdAt: session.createdAt,
        },
      ];
    });
  },

  async handleMessage({
    userId,
    groupId,
    message,
  }: {
    userId: string;
    groupId: string;
    message: string;
  }): Promise<AssistantPayload> {
    const recentSessions = await prisma.aiSession.findMany({
      where: { userId, model: `${MODEL_PREFIX}:${groupId}` },
      orderBy: { createdAt: "asc" },
      take: HISTORY_LIMIT,
    });

    const pendingAction = getLatestPendingAction(recentSessions);
    const historyMessages = buildHistoryMessages(
      recentSessions.map((s) => ({ prompt: s.prompt, response: s.response }))
    );

    /* ---------- 1) Pending confirmation flow ---------- */
    const pendingPayload = await handlePendingAction({
      groupId,
      message,
      pendingAction,
    });

    if (pendingPayload) {
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: pendingPayload,
      });
      return pendingPayload;
    }

    /* ---------- 2) LLM parse ---------- */
    const result = await generateText({
      model: openai(env.AI_MODEL),
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: message },
      ],
    });

    const parsed = parseLLMJson(result.text);
    if (!parsed) {
      const payload = toPayload({
        message:
          "I couldn't understand that. Please share the airline, flight number, and date.",
        status: "clarify",
      });
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: payload,
      });
      return payload;
    }

    /* ---------- 3) Group context ---------- */
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      const payload = toPayload({
        message: "I couldn't find that group.",
        status: "error",
      });
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: payload,
      });
      return payload;
    }

    const tripStart = group.startDate?.toISOString().slice(0, 10) ?? null;
    const tripEnd = group.endDate?.toISOString().slice(0, 10) ?? null;

    const cleanRequests = buildCleanRequests({
      flightRequests: parsed.flightRequests,
      tripStart,
      tripEnd,
    });

    if (!cleanRequests.length) {
      const payload = toPayload({
        message:
          "I need the airline, flight number, and date to find the flight. Can you provide those?",
        status: "clarify",
      });
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: payload,
      });
      return payload;
    }

    /* ---------- 4) Resolve flights + members ---------- */
    const { allFlights, memberIds, unknownPassengers } =
      await resolveFlightsAndMembers({
        userId,
        groupMembers: group.members,
        requests: cleanRequests,
      });

    /* ---------- 5) Decide next step ---------- */
    const finalPayload = toPayload(
      decideNextStep({ allFlights, memberIds, unknownPassengers })
    );

    await saveExchange({
      userId,
      groupId,
      userMessage: message,
      assistantPayload: finalPayload,
    });

    return finalPayload;
  },
};

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

async function saveExchange(opts: {
  userId: string;
  groupId: string;
  userMessage: string;
  assistantPayload: AssistantPayload;
}) {
  await prisma.aiSession.create({
    data: {
      userId: opts.userId,
      prompt: opts.userMessage,
      response: JSON.stringify(opts.assistantPayload),
      model: `${MODEL_PREFIX}:${opts.groupId}`,
    },
  });
}

async function handlePendingAction(args: {
  groupId: string;
  message: string;
  pendingAction: PendingAction | null;
}): Promise<AssistantPayload | null> {
  const { groupId, message, pendingAction } = args;
  if (!pendingAction) return null;

  const normalized = message.trim().toLowerCase();
  const isYes = yesNo.yes.some((t) => normalized.includes(t));
  const isNo = yesNo.no.some((t) => normalized.includes(t));

  if (pendingAction.type === "create-flight") {
    if (isNo) {
      return toPayload({
        message:
          "Okay, I won't add that flight. Tell me the airline, flight number, and date to try again.",
        status: "clarify",
      });
    }

    if (!isYes) {
      return toPayload({
        message: "Should I add this flight? Reply yes or no.",
        status: "clarify",
        pendingAction,
      });
    }

    const flights = pendingAction.options?.length
      ? pendingAction.options
      : [pendingAction.flight];

    const ids: string[] = [];
    const lines: string[] = [];

    for (const f of flights) {
      const created = await transportService.createFlightItineraryItem({
        groupId,
        airlineCode: f.airlineCode,
        flightNumber: f.flightNumber,
        departureDate: new Date(f.departureTime),
        memberIds: pendingAction.memberIds,
      });

      ids.push(created.id);
      lines.push(`- ${describeFlight(f)}`);
    }

    return toPayload({
      message: `Added ${ids.length} flight${
        ids.length > 1 ? "s" : ""
      }:\n${lines.join("\n")}`,
      status: "created",
      createdItemId: ids[0],
    });
  }

  if (pendingAction.type === "choose-flight") {
    const index = Number(message.match(/(\d+)/)?.[1]) - 1;
    const selected = pendingAction.options[index];

    if (!selected) {
      return toPayload({
        message: `Please choose a flight:\n${summarizeFlightOptions(
          pendingAction.options
        )}`,
        status: "clarify",
        pendingAction,
      });
    }

    const created = await transportService.createFlightItineraryItem({
      groupId,
      airlineCode: selected.airlineCode,
      flightNumber: selected.flightNumber,
      departureDate: new Date(selected.departureTime),
      memberIds: pendingAction.memberIds,
    });

    return toPayload({
      message: `Added ${describeFlight(selected)}`,
      status: "created",
      createdItemId: created.id,
    });
  }

  return null;
}

async function resolveFlightsAndMembers(args: {
  userId: string;
  groupMembers: { id: string; displayName: string; userId: string | null }[];
  requests: {
    airlineCode: string | null;
    airlineName: string | null;
    flightNumber: string;
    departureDate: string;
    passengers: string[];
  }[];
}) {
  const allFlights: ResolvedFlight[] = [];
  let memberIds: string[] = [];
  let unknownPassengers: string[] = [];

  for (const req of args.requests) {
    const resolved = resolveMemberIdsFromNames(
      req.passengers,
      args.groupMembers,
      args.userId
    );

    memberIds = [...new Set([...memberIds, ...resolved.memberIds])];
    unknownPassengers = [
      ...new Set([...unknownPassengers, ...resolved.unknownPassengers]),
    ];

    const flights = await fetchFlightScheduleCandidates({
      airlineCode: req.airlineCode!,
      airlineName: req.airlineName ?? undefined,
      flightNumber: req.flightNumber,
      departureDate: new Date(req.departureDate),
    });

    allFlights.push(...flights);
  }

  return { allFlights, memberIds, unknownPassengers };
}

function decideNextStep(args: {
  allFlights: ResolvedFlight[];
  memberIds: string[];
  unknownPassengers: string[];
}): AssistantPayload {
  const { allFlights, memberIds, unknownPassengers } = args;

  if (!allFlights.length) {
    return {
      message:
        "I couldn't find matching flights. Can you double-check the airline, flight number, and date?",
      status: "clarify",
    };
  }

  if (allFlights.length > 1) {
    return {
      message: `I found multiple flights:\n${summarizeFlightOptions(
        allFlights
      )}`,
      status: "confirm",
      options: allFlights,
      pendingAction: {
        type: "choose-flight",
        options: allFlights,
        memberIds,
      },
    };
  }

  const flight = allFlights[0]!;
  const extra = unknownPassengers.length
    ? ` I couldn't match passengers: ${unknownPassengers.join(", ")}.`
    : "";

  return {
    message: `I found ${describeFlight(flight)}. Should I add it?${extra}`,
    status: "confirm",
    pendingAction: {
      type: "create-flight",
      flight,
      memberIds,
    },
  };
}
