import { CoreMessage, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import env from "../config/env";
import { prisma } from "../lib/prisma";
import { AIRPORTS_BY_CODE } from "../constants/airports";
import { AIRLINES_BY_CODE, resolveAirline } from "../constants/airlines";
import {
  TripLocationType,
  TripTransportMode,
  TripItineraryItemStatus,
  TripItineraryItemType,
} from "@prisma/client";

type FlightRequest = {
  airlineCode?: string;
  airlineName?: string;
  flightNumber?: string;
  departureDate?: string;
  explicitDate?: string;
  departureDateHint?: string;
  timeWindow?: string;
  approxLocalTime?: string;
  originHint?: string | null;
  destinationHint?: string | null;
  origin?: string | null;
  destination?: string | null;
  passengers?: string[];
  passengerNames?: string[];
};

type ParsedChat = {
  flightRequests: FlightRequest[];
  notes?: string;
};

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

type ResolvedFlight = {
  airlineCode: string;
  airlineName: string | null;
  flightNumber: string;
  departureTime: Date;
  arrivalTime: Date | null;
  originCode: string | null;
  originName: string | null;
  destinationCode: string | null;
  destinationName: string | null;
  raw: unknown;
};

type AssistantPayload = {
  message: string;
  status: "clarify" | "confirm" | "created" | "error";
  pendingAction?: PendingAction | null;
  options?: ResolvedFlight[];
  createdItemId?: string;
};

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

const MODEL_PREFIX = "flight-chat";
const HISTORY_LIMIT = 10;

const yesNo = {
  yes: ["yes", "yep", "sure", "confirm", "yeah", "yup"],
  no: ["no", "nah", "nope", "cancel", "stop"],
};

const normalize = (value?: string | null) =>
  typeof value === "string" ? value.trim() : "";

const findAirlineByName = (name?: string | null) => {
  if (!name) return null;
  const target = name.trim().toLowerCase();
  return Object.values(AIRLINES_BY_CODE).find(
    (airline) => airline.name.toLowerCase() === target
  );
};

const parseAssistantPayload = (raw: string | null): AssistantPayload | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AssistantPayload;
    if (parsed && typeof parsed.message === "string") return parsed;
  } catch {
    return null;
  }
  return null;
};

const buildHistoryMessages = (
  records: { prompt: string; response: string }[]
): CoreMessage[] => {
  const messages: CoreMessage[] = [];
  records.forEach((record) => {
    const parsedAssistant = parseAssistantPayload(record.response);
    messages.push({ role: "user", content: record.prompt });
    if (parsedAssistant) {
      messages.push({ role: "assistant", content: parsedAssistant.message });
    } else if (record.response) {
      messages.push({ role: "assistant", content: record.response });
    }
  });
  return messages;
};

const getLatestPendingAction = (
  sessions: { response: string }[]
): PendingAction | null => {
  for (let i = sessions.length - 1; i >= 0; i -= 1) {
    const parsed = parseAssistantPayload(sessions[i]?.response ?? null);
    if (
      parsed?.pendingAction?.type === "create-flight" ||
      parsed?.pendingAction?.type === "choose-flight"
    ) {
      return parsed.pendingAction as PendingAction;
    }
  }
  return null;
};

const systemPrompt = `
You are an assistant that reads freeform text about flights for a specific trip
and converts it into a strict JSON structure describing flight legs.

You MUST:
- Use ONLY the provided trip context and user message.
- Identify each mentioned flight as a separate "leg".
- Extract airline name or code, flight number, direction (outbound vs return),
  date hints, time hints, and passenger names when possible.
- Use the trip start and end dates ONLY as hints, not as hard facts.

Rules:
- Do not invent flights or flight numbers.
- If the user says "outbound", "there", or similar, set role = "OUTBOUND".
- If the user says "return", "back", or similar, set role = "RETURN".
- If direction is unclear, set role = "OTHER".
- If the user does not specify a date, but clearly means "going there at the
  start of the trip", set departureDateHint = "TRIP_START".
- If they clearly refer to the end of the trip, set departureDateHint = "TRIP_END".
- If unclear, use "UNKNOWN".
- If they mention a time window like "around 11am" or "evening", set timeWindow accordingly.
- Always list the passengerNames as they appear in the text (split by "and"/commas);
  do not try to match them to user IDs.

Output:
- Return ONLY a single JSON object with this exact TypeScript shape:

{
  "flightRequests": [
    {
      "role": "OUTBOUND" | "RETURN" | "OTHER",
      "airlineCode": string | null,
      "airlineName": string | null,
      "flightNumber": string | null,
      "departureDateHint": "TRIP_START" | "TRIP_END" | "UNKNOWN",
      "explicitDate": string | null,            // "YYYY-MM-DD" if present
      "timeWindow": "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT" | "UNKNOWN",
      "approxLocalTime": string | null,        // "HH:mm" or null
      "originHint": string | null,
      "destinationHint": string | null,
      "passengerNames": string[]
    }
  ]
}

Do NOT include any extra keys or commentary.
`.trim();

const resolveMembers = (
  passengers: string[] | undefined,
  groupMembers: { id: string; displayName: string; userId: string | null }[],
  currentUserId: string
): { memberIds: string[]; unknownPassengers: string[] } => {
  const names = passengers ?? ["me"];
  const memberIds = new Set<string>();
  const unknown: string[] = [];

  names.forEach((nameRaw) => {
    const name = nameRaw.trim().toLowerCase();
    if (!name) return;
    if (["me", "i", "my", "myself"].includes(name)) {
      const self = groupMembers.find((m) => m.userId === currentUserId);
      if (self) memberIds.add(self.id);
      return;
    }
    const match = groupMembers.find((m) =>
      m.displayName.toLowerCase().includes(name)
    );
    if (match) {
      memberIds.add(match.id);
      return;
    }
    unknown.push(nameRaw);
  });

  if (!memberIds.size) {
    const self = groupMembers.find((m) => m.userId === currentUserId);
    if (self) {
      memberIds.add(self.id);
    }
  }

  return { memberIds: Array.from(memberIds), unknownPassengers: unknown };
};

const fetchFlightSchedule = async (
  request: Required<
    Pick<FlightRequest, "airlineCode" | "flightNumber" | "departureDate">
  > & { airlineName?: string | null }
): Promise<ResolvedFlight[]> => {
  if (!env.AERO_API_URL || !env.AERO_API_KEY) {
    throw new Error("AERO API is not configured");
  }

  const formatDateParam = (value: Date): string =>
    value.toISOString().slice(0, 10);
  const start = new Date(request.departureDate);
  const startDate = formatDateParam(start);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const endDate = formatDateParam(end);

  const baseUrl = env.AERO_API_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/schedules/${startDate}/${endDate}?airline=${encodeURIComponent(
    request.airlineCode ?? ""
  )}&flight_number=${encodeURIComponent(request.flightNumber ?? "")}`;

  console.log("[TransportChat] Fetching Aero API", { url });

  const response = await fetch(url, {
    headers: {
      "x-apikey": env.AERO_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`AERO API failed with status ${response.status}`);
  }

  const payload = (await response.json()) as
    | { scheduled?: unknown }
    | unknown[];
  const flights: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { scheduled?: unknown }).scheduled)
    ? ((payload as { scheduled?: unknown }).scheduled as any[])
    : [];

  return flights
    .map((flight) => {
      const departureTime = flight.scheduled_out
        ? new Date(flight.scheduled_out)
        : null;
      if (!departureTime || Number.isNaN(departureTime.getTime())) return null;
      const arrival = flight.scheduled_in
        ? new Date(flight.scheduled_in)
        : null;
      return {
        airlineCode: (
          flight.operator_iata ||
          flight.airline_iata ||
          request.airlineCode ||
          ""
        ).toUpperCase(),
        airlineName:
          flight.operator ||
          flight.airline_name ||
          request.airlineName ||
          AIRLINES_BY_CODE[request.airlineCode]?.name ||
          null,
        flightNumber: request.flightNumber,
        departureTime,
        arrivalTime:
          arrival && !Number.isNaN(arrival.getTime()) ? arrival : null,
        originCode: flight.origin_iata?.toUpperCase?.() || null,
        originName: flight.origin_name || null,
        destinationCode: flight.destination_iata?.toUpperCase?.() || null,
        destinationName: flight.destination_name || null,
        raw: flight,
      } as ResolvedFlight;
    })
    .filter(Boolean) as ResolvedFlight[];
};

const makeItineraryPayload = (
  flight: ResolvedFlight,
  groupId: string,
  memberIds: string[]
) => {
  const airline = AIRLINES_BY_CODE[flight.airlineCode];
  const originAirport = flight.originCode
    ? AIRPORTS_BY_CODE[flight.originCode]
    : undefined;
  const destinationAirport = flight.destinationCode
    ? AIRPORTS_BY_CODE[flight.destinationCode]
    : undefined;

  return {
    data: {
      groupId,
      type: TripItineraryItemType.FLIGHT,
      status: TripItineraryItemStatus.CONFIRMED,
      title: `${airline?.name ?? flight.airlineName ?? flight.airlineCode} ${
        flight.flightNumber
      }`,
      transportMode: TripTransportMode.FLIGHT,
      startDateTime: flight.departureTime,
      endDateTime: flight.arrivalTime ?? undefined,
      originLocationCode: flight.originCode ?? undefined,
      originLocationType: flight.originCode
        ? TripLocationType.AIRPORT
        : undefined,
      originName: originAirport?.name ?? flight.originCode ?? undefined,
      originAddress: originAirport?.city
        ? `${originAirport.city}${
            originAirport.country ? `, ${originAirport.country}` : ""
          }`
        : undefined,
      destinationLocationCode: flight.destinationCode ?? undefined,
      destinationLocationType: flight.destinationCode
        ? TripLocationType.AIRPORT
        : undefined,
      destinationName:
        destinationAirport?.name ?? flight.destinationCode ?? undefined,
      destinationAddress: destinationAirport?.city
        ? `${destinationAirport.city}${
            destinationAirport.country ? `, ${destinationAirport.country}` : ""
          }`
        : undefined,
      transportNumber: `${flight.airlineCode}${flight.flightNumber}`,
      airlineCode: flight.airlineCode,
      airlineName: airline?.name ?? flight.airlineName,
      flightNumber: flight.flightNumber,
      rawTransportPayload: JSON.parse(JSON.stringify(flight.raw)),
      memberAssignments: memberIds.length
        ? {
            create: memberIds.map((memberId) => ({ memberId })),
          }
        : undefined,
    },
  };
};

const formatDateLabel = (value: Date, timeZone?: string | null) =>
  value.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timeZone || undefined,
  });

const formatTimeLabel = (value: Date, timeZone?: string | null) =>
  value.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timeZone || undefined,
  });

const describeFlight = (flight: ResolvedFlight) => {
  const airlineName =
    AIRLINES_BY_CODE[flight.airlineCode]?.name ??
    flight.airlineName ??
    flight.airlineCode;

  const originAirport = flight.originCode
    ? AIRPORTS_BY_CODE[flight.originCode]
    : undefined;
  const destinationAirport = flight.destinationCode
    ? AIRPORTS_BY_CODE[flight.destinationCode]
    : undefined;

  const startDate = formatDateLabel(
    flight.departureTime,
    originAirport?.timezone
  );
  const startTime = formatTimeLabel(
    flight.departureTime,
    originAirport?.timezone
  );
  const endDateLabel = flight.arrivalTime
    ? formatDateLabel(flight.arrivalTime, destinationAirport?.timezone)
    : null;
  const endTimeLabel = flight.arrivalTime
    ? formatTimeLabel(flight.arrivalTime, destinationAirport?.timezone)
    : null;

  const sameDate =
    endDateLabel && startDate === endDateLabel && Boolean(flight.arrivalTime);

  const originName = originAirport?.name ?? flight.originCode ?? "Origin";
  const destinationName =
    destinationAirport?.name ?? flight.destinationCode ?? "Destination";
  const originCode = flight.originCode ?? "UNK";
  const destinationCode = flight.destinationCode ?? "UNK";

  const datePortion = sameDate
    ? `on ${startDate} departing at ${startTime} and arriving at ${endTimeLabel}`
    : `departing on ${startDate} ${startTime}${
        endDateLabel && endTimeLabel
          ? ` and arriving on ${endDateLabel} ${endTimeLabel}`
          : ""
      }`;

  return `${airlineName} ${flight.flightNumber} from ${originName} (${originCode}) to ${destinationName} (${destinationCode}) ${datePortion}.`;
};

const selectDepartureDate = (
  req: FlightRequest,
  tripStart?: string | null,
  tripEnd?: string | null
) => {
  const explicit =
    normalize(req.explicitDate) || normalize(req.departureDate) || "";
  if (explicit) return explicit;
  const hint = normalize(req.departureDateHint).toUpperCase();
  if (hint === "TRIP_START" && tripStart) return tripStart;
  if (hint === "TRIP_END" && tripEnd) return tripEnd;
  return "";
};

const resolveAirlineInfo = (req: FlightRequest) => {
  console.log("resolve airline info)", req);
  const airline = resolveAirline(
    normalize(req.airlineCode) || normalize(req.airlineName)
  );
  const airlineCode = airline && airline.code;
  const airlineName = airline && airline.name;
  console.log(airlineCode);
  console.log(airlineName);
  // const code = normalize(req.airlineCode).toUpperCase();
  // const name = normalize(req.airlineName);
  // const byCode = code ? AIRLINES_BY_CODE[code] : undefined;
  // const byName = name ? findAirlineByName(name) : undefined;
  // console.log(code, name, byCode, byName);
  // const airlineCode = code || byCode?.code || null;
  // const airlineName = byCode?.name ?? byName?.name ?? (name || null);

  return { airlineCode, airlineName };
};

const saveExchange = async ({
  userId,
  groupId,
  userMessage,
  assistantPayload,
}: {
  userId: string;
  groupId: string;
  userMessage: string;
  assistantPayload: AssistantPayload;
}) => {
  await prisma.aiSession.create({
    data: {
      userId,
      prompt: userMessage,
      response: JSON.stringify(assistantPayload),
      model: `${MODEL_PREFIX}:${groupId}`,
    },
  });
};

export const transportChatService = {
  async getHistory({
    userId,
    groupId,
  }: {
    userId: string;
    groupId: string;
  }): Promise<
    {
      id: string;
      role: "user" | "assistant";
      message: string;
      createdAt: Date;
    }[]
  > {
    const sessions = await prisma.aiSession.findMany({
      where: { userId, model: `${MODEL_PREFIX}:${groupId}` },
      orderBy: { createdAt: "asc" },
      take: HISTORY_LIMIT,
    });

    return sessions.flatMap((session) => {
      const parts: {
        id: string;
        role: "user" | "assistant";
        message: string;
        createdAt: Date;
      }[] = [
        {
          id: `${session.id}-user`,
          role: "user",
          message: session.prompt,
          createdAt: session.createdAt,
        },
      ];

      const parsedAssistant = parseAssistantPayload(session.response);
      const assistantMessage =
        parsedAssistant?.message ?? session.response ?? "…";

      parts.push({
        id: `${session.id}-assistant`,
        role: "assistant",
        message: assistantMessage,
        createdAt: session.createdAt,
      });

      return parts;
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

    const historyMessages = buildHistoryMessages(
      recentSessions.map((s) => ({ prompt: s.prompt, response: s.response }))
    );
    const pendingAction = getLatestPendingAction(recentSessions);

    if (pendingAction?.type === "create-flight") {
      console.log(
        "[TransportChat] Pending create-flight action found; bypassing LLM"
      );
      const normalized = message.trim().toLowerCase();
      const isYes = yesNo.yes.some((token) => normalized.includes(token));
      const isNo = yesNo.no.some((token) => normalized.includes(token));

      if (isYes) {
        const flightsToCreate =
          pendingAction.options && pendingAction.options.length
            ? pendingAction.options
            : [pendingAction.flight];

        const createdItems = [];
        for (const flight of flightsToCreate) {
          const departureTime =
            typeof flight.departureTime === "string"
              ? new Date(flight.departureTime)
              : flight.departureTime;
          const arrivalTime =
            typeof flight.arrivalTime === "string"
              ? new Date(flight.arrivalTime)
              : flight.arrivalTime;

          if (!departureTime || Number.isNaN(departureTime.getTime())) {
            continue;
          }

          const normalizedFlight: ResolvedFlight = {
            ...flight,
            departureTime,
            arrivalTime:
              arrivalTime && !Number.isNaN(arrivalTime.getTime())
                ? arrivalTime
                : null,
          };

          const created = await prisma.tripItineraryItem.create({
            ...makeItineraryPayload(normalizedFlight, groupId, pendingAction.memberIds),
          });
          createdItems.push({ created, normalizedFlight });
        }

        const first = createdItems[0];
        const summary =
          createdItems.length > 0
            ? createdItems
                .map((item) => `- ${describeFlight(item.normalizedFlight)}`)
                .join("\n")
            : "";

        const payload: AssistantPayload = {
          message: createdItems.length
            ? `Added ${createdItems.length} flight${createdItems.length > 1 ? "s" : ""} to the trip:\n${summary}`
            : "I couldn't add the flight. Please share the details again.",
          status: createdItems.length ? "created" : "clarify",
          createdItemId: first?.created.id,
        };

        await saveExchange({
          userId,
          groupId,
          userMessage: message,
          assistantPayload: payload,
        });
        return payload;
      }

      if (isNo) {
        const payload: AssistantPayload = {
          message:
            "Okay, I won't add that flight. Tell me the airline, flight number, and date to try again.",
          status: "clarify",
          pendingAction: null,
        };
        await saveExchange({
          userId,
          groupId,
          userMessage: message,
          assistantPayload: payload,
        });
        return payload;
      }

      const payload: AssistantPayload = {
        message: "Should I add this flight? Reply yes or no.",
        status: "clarify",
        pendingAction,
      };
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: payload,
      });
      return payload;
    }

    if (pendingAction?.type === "choose-flight") {
      console.log(
        "[TransportChat] Pending choose-flight action found; bypassing LLM"
      );
      const match = message.match(/(\d+)/);
      const index = match ? Number(match[1]) - 1 : -1;
      const selected =
        index >= 0 && index < pendingAction.options.length
          ? pendingAction.options[index]
          : null;

      if (selected) {
        const normalizedFlight: ResolvedFlight = {
          ...selected,
          departureTime:
            typeof selected.departureTime === "string"
              ? new Date(selected.departureTime)
              : selected.departureTime,
          arrivalTime:
            typeof selected.arrivalTime === "string"
              ? new Date(selected.arrivalTime)
              : selected.arrivalTime,
        };

        const created = await prisma.tripItineraryItem.create({
          ...makeItineraryPayload(
            normalizedFlight,
            groupId,
            pendingAction.memberIds
          ),
        });

        const payload: AssistantPayload = {
          message: `Added ${describeFlight(normalizedFlight)}`,
          status: "created",
          createdItemId: created.id,
        };

        await saveExchange({
          userId,
          groupId,
          userMessage: message,
          assistantPayload: payload,
        });
        return payload;
      }

      const summary = pendingAction.options
        .slice(0, 5)
        .map((f, idx) => `${idx + 1}. ${describeFlight(f)}`)
        .join("\n");
      const payload: AssistantPayload = {
        message: `Please pick a flight number from these options:\n${summary}`,
        status: "clarify",
        pendingAction,
      };
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: payload,
      });
      return payload;
    }

    const messages: CoreMessage[] = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: message },
    ];

    console.log("[TransportChat] Sending prompts to LLM", {
      groupId,
      userId,
      systemPrompt,
      messages,
    });

    const result = await generateText({
      model: openai(env.AI_MODEL),
      messages,
    });

    console.log("[TransportChat] LLM response", {
      groupId,
      userId,
      text: result.text,
    });

    let parsed: ParsedChat | null = null;
    try {
      parsed = JSON.parse(result.text) as ParsedChat;
    } catch {
      parsed = null;
    }

    if (!parsed || !Array.isArray(parsed.flightRequests)) {
      const payload: AssistantPayload = {
        message:
          "I couldn't understand that. Please share the airline, flight number, and date.",
        status: "clarify",
      };
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: payload,
      });
      return payload;
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      const payload: AssistantPayload = {
        message: "I couldn't find that group.",
        status: "error",
      };
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: payload,
      });
      return payload;
    }

    const tripStart = group.startDate
      ? group.startDate.toISOString().slice(0, 10)
      : null;
    const tripEnd = group.endDate
      ? group.endDate.toISOString().slice(0, 10)
      : null;

    const cleanRequests = parsed.flightRequests
      .map((req) => {
        const airline = resolveAirlineInfo(req);
        const departureDate = selectDepartureDate(req, tripStart, tripEnd);
        console.log("filter");
        console.log(airline);
        console.log(departureDate);
        console.log(req.flightNumber);

        return {
          airlineCode: airline.airlineCode,
          airlineName: airline.airlineName,
          flightNumber: normalize(req.flightNumber),
          departureDate,
          origin:
            normalize(req.origin ?? req.originHint) ||
            normalize(req.originHint) ||
            null,
          destination:
            normalize(req.destination ?? req.destinationHint) ||
            normalize(req.destinationHint) ||
            null,
          passengers:
            req.passengers?.map((p) => p.trim()).filter(Boolean) ??
            req.passengerNames?.map((p) => p.trim()).filter(Boolean) ??
            [],
        };
      })
      .filter(
        (req) => req.airlineCode && req.flightNumber && req.departureDate
      );

    if (!cleanRequests.length) {
      const payload: AssistantPayload = {
        message:
          "I need the airline, flight number, and date to find the flight. Can you provide those?",
        status: "clarify",
      };
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: payload,
      });
      return payload;
    }

    const allFlights: ResolvedFlight[] = [];
    let unknownPassengers: string[] = [];
    let memberIds: string[] = [];

    for (const req of cleanRequests) {
      const { memberIds: resolvedMembers, unknownPassengers: unknown } =
        resolveMembers(req.passengers, group.members, userId);
      memberIds = Array.from(new Set([...memberIds, ...resolvedMembers]));
      unknownPassengers = Array.from(
        new Set([...unknownPassengers, ...unknown])
      );
      const flights = await fetchFlightSchedule({
        airlineCode: req.airlineCode as string,
        airlineName: req.airlineName ?? undefined,
        flightNumber: req.flightNumber as string,
        departureDate: req.departureDate as string,
      });
      flights.forEach((flight) => allFlights.push(flight));
    }

    if (!allFlights.length) {
      const payload: AssistantPayload = {
        message:
          "I couldn't find matching flights. Can you double-check the airline, flight number, and date?",
        status: "clarify",
      };
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: payload,
      });
      return payload;
    }

    if (allFlights.length > 1) {
      const flightsByDate = allFlights.reduce<Record<string, ResolvedFlight[]>>(
        (acc, flight) => {
          const dateKey = flight.departureTime.toISOString().slice(0, 10);
          acc[dateKey] = acc[dateKey] ?? [];
          acc[dateKey].push(flight);
          return acc;
        },
        {}
      );

      const hasSameDateGroup = Object.values(flightsByDate).some(
        (list) => list.length > 1
      );

      if (hasSameDateGroup) {
        const summary = allFlights
          .slice(0, 5)
          .map((f, idx) => `${idx + 1}. ${describeFlight(f)}`)
          .join("\n");
        const payload: AssistantPayload = {
          message: `I found multiple flights on the same date. Which one should I add?\n${summary}`,
          status: "clarify",
          options: allFlights,
          pendingAction: {
            type: "choose-flight",
            options: allFlights,
            memberIds,
          },
        };
        await saveExchange({
          userId,
          groupId,
          userMessage: message,
          assistantPayload: payload,
        });
        return payload;
      }

      // Different dates (e.g., outbound + return) — ask for confirmation once.
      const summary = allFlights
        .slice(0, 5)
        .map((f, idx) => `${idx + 1}. ${describeFlight(f)}`)
        .join("\n");
      const payload: AssistantPayload = {
        message: `I found these flights on different days:\n${summary}\nShould I add them all?`,
        status: "confirm",
        pendingAction: {
          type: "create-flight",
          flight: allFlights[0]!,
          memberIds,
          options: allFlights,
        },
        options: allFlights,
      };
      await saveExchange({
        userId,
        groupId,
        userMessage: message,
        assistantPayload: payload,
      });
      return payload;
    }

    const flight = allFlights[0]!;
    const extra = unknownPassengers.length
      ? ` I couldn't match passengers: ${unknownPassengers.join(", ")}.`
      : "";

    const payload: AssistantPayload = {
      message: `I found ${describeFlight(
        flight
      )} Should I add it to the trip?${extra}`,
      status: "confirm",
      pendingAction: {
        type: "create-flight",
        flight,
        memberIds,
      },
    };

    await saveExchange({
      userId,
      groupId,
      userMessage: message,
      assistantPayload: payload,
    });
    return payload;
  },
};
