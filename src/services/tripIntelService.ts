import { GroupType, Prisma } from "@prisma/client";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import env from "../config/env";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { TRIP_BASE_SYSTEM_PROMPT } from "../prompts/system/trips/base";
import { TRIP_SNAPSHOT_SYSTEM_PROMPT } from "../prompts/system/trips/snapshot";
import {
  TRIP_BASE_USER_PROMPT_TEMPLATE,
  TripCoreInput,
  TripExpenseInput,
  TripExpenseSummaryInput,
  TripItineraryItemInput,
} from "../prompts/user/trips/base";
import { TRIP_SNAPSHOT_USER_PROMPT_TEMPLATE, TripSnapshotInput } from "../prompts/user/trips/snapshot";

const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

const MAX_EXPENSES_FOR_PROMPT = 25;
const MAX_ITINERARY_ITEMS_FOR_PROMPT = 25;

type TripWithContext = Prisma.GroupGetPayload<{
  include: {
    members: true;
    expenses: {
      include: { participants: true };
      orderBy: { date: "desc" };
      take: typeof MAX_EXPENSES_FOR_PROMPT;
    };
    tripItineraryItems: {
      orderBy: { startDateTime: "asc" };
      take: typeof MAX_ITINERARY_ITEMS_FOR_PROMPT;
    };
  };
}>;

type ExpenseTotalsRow = {
  currency: string;
  _sum: { amount: Prisma.Decimal | null };
  _count: { _all: number };
};

const toNumber = (value: Prisma.Decimal | number | string | null | undefined): number => {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  if (typeof value === "string") {
    return parseFloat(value);
  }

  if (typeof value === "number") {
    return value;
  }

  return 0;
};

const buildExpenseSummary = (totals: ExpenseTotalsRow[], latestExpenseDate: Date | null): TripExpenseSummaryInput => {
  const totalsByCurrency = totals.map((row) => ({
    currency: row.currency,
    total: toNumber(row._sum.amount),
    count: row._count._all,
  }));

  const totalExpenses = totals.reduce((sum, row) => sum + row._count._all, 0);

  return {
    totalExpenses,
    totalsByCurrency,
    latestExpenseDate: latestExpenseDate ? latestExpenseDate.toISOString() : null,
  };
};

const mapExpenses = (expenses: TripWithContext["expenses"]): TripExpenseInput[] => {
  return expenses.map((expense) => ({
    expenseId: expense.id,
    name: expense.name,
    vendor: expense.vendor,
    description: expense.description,
    amount: toNumber(expense.amount),
    currency: expense.currency,
    date: expense.date.toISOString(),
    status: expense.status,
    splitType: expense.splitType,
    participantCount: expense.participants?.length ?? 0,
  }));
};

const mapItineraryItems = (items: TripWithContext["tripItineraryItems"]): TripItineraryItemInput[] => {
  return items.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    status: item.status,
    startDateTime: item.startDateTime.toISOString(),
    endDateTime: item.endDateTime ? item.endDateTime.toISOString() : null,
    allDay: item.allDay,
    locationName: item.locationName,
    locationAddress: item.locationAddress,
  }));
};

const buildTripSnapshotInput = (
  trip: TripWithContext,
  expenseSummary: TripExpenseSummaryInput,
): TripSnapshotInput => {
  const tripCore: TripCoreInput = {
    tripId: trip.id,
    tripName: trip.name,
    primaryLocation: trip.primaryLocation ?? null,
    baseCurrency: trip.baseCurrency ?? null,
    startDate: trip.startDate ? trip.startDate.toISOString() : null,
    endDate: trip.endDate ? trip.endDate.toISOString() : null,
    memberCount: trip.members.length,
    members: trip.members.map((member) => ({
      memberId: member.id,
      displayName: member.displayName,
      email: member.email,
      userId: member.userId,
    })),
    expenseSummary,
    expenses: mapExpenses(trip.expenses),
    itinerary: mapItineraryItems(trip.tripItineraryItems),
  };

  return tripCore;
};

const buildUserPrompt = (tripInput: TripSnapshotInput): string => {
  const combinedTemplate = [TRIP_BASE_USER_PROMPT_TEMPLATE, TRIP_SNAPSHOT_USER_PROMPT_TEMPLATE]
    .map((prompt) => prompt.trim())
    .join("\n\n");

  return combinedTemplate.replace(/{{trip_core_json}}/g, JSON.stringify(tripInput, null, 2));
};

const buildSystemPrompt = (): string => {
  return [TRIP_BASE_SYSTEM_PROMPT, TRIP_SNAPSHOT_SYSTEM_PROMPT]
    .map((prompt) => prompt.trim())
    .join("\n\n");
};

export interface TripIntelResponse {
  tripId: string;
  sections: {
    snapshot: {
      content: string;
      generatedAt: string;
      model: string;
      fromCache: boolean;
    };
  };
}

export const tripIntelService = {
  async getTripSnapshot({
    tripId,
    userId,
  }: {
    tripId: string;
    userId: string;
  }): Promise<TripIntelResponse> {
    const trip = await prisma.group.findUnique({
      where: { id: tripId },
      include: {
        members: true,
        expenses: {
          include: { participants: true },
          orderBy: { date: "desc" },
          take: MAX_EXPENSES_FOR_PROMPT,
        },
        tripItineraryItems: {
          orderBy: { startDateTime: "asc" },
          take: MAX_ITINERARY_ITEMS_FOR_PROMPT,
        },
      },
    });

    if (!trip) {
      throw new ApiError("Trip not found", 404);
    }

    if (trip.type !== GroupType.TRIP) {
      throw new ApiError("Group is not a trip", 400);
    }

    const isMember = trip.members.some((member) => member.userId === userId);
    if (!isMember) {
      throw new ApiError("You are not a member of this trip", 403);
    }

    const [expenseTotals, latestExpenseDate] = await Promise.all([
      prisma.expense.groupBy({
        by: ["currency"],
        where: { groupId: tripId },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.expense.findFirst({
        where: { groupId: tripId },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
    ]);

    const expenseSummary = buildExpenseSummary(
      expenseTotals as ExpenseTotalsRow[],
      latestExpenseDate?.date ?? null,
    );

    const tripInput = buildTripSnapshotInput(trip, expenseSummary);
    const userPrompt = buildUserPrompt(tripInput);
    const systemPrompt = buildSystemPrompt();

    const result = await generateText({
      model: openai(env.AI_MODEL),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    return {
      tripId,
      sections: {
        snapshot: {
          content: result.text,
          generatedAt: new Date().toISOString(),
          model: env.AI_MODEL,
          fromCache: false,
        },
      },
    };
  },
};
