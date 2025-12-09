// Expense data for the trip
export interface TripExpenseInput {
  expenseId: string;
  name: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  currency: string;
  date: string;
  status: string;
  splitType: string;
  participantCount: number;
}

// Summary of expenses for the trip
export interface TripExpenseSummaryInput {
  totalExpenses: number;
  totalsByCurrency: Array<{
    currency: string;
    total: number;
    count: number;
  }>;
  latestExpenseDate: string | null;
}

// Itinerary item for the trip
export interface TripItineraryItemInput {
  id: string;
  type: string;
  title: string;
  status: string;
  startDateTime: string;
  endDateTime: string | null;
  allDay: boolean;
  locationName: string | null;
  locationAddress: string | null;
}

// Common core payload you can reuse in all user prompts
export interface TripCoreInput {
  tripId: string;
  tripName?: string;
  primaryLocation?: string | null;
  destination?: string; // "Whistler, British Columbia"
  description?: string | null;
  baseCurrency?: string | null;
  startDate: string | null; // ISO date string: "2026-02-15"
  endDate: string | null; // ISO date string: "2026-02-20"
  memberCount?: number;
  members?: Array<{
    memberId: string;
    displayName: string;
    email: string | null;
    userId: string | null;
  }>;
  expenseSummary?: TripExpenseSummaryInput;
  expenses?: TripExpenseInput[];
  itinerary?: TripItineraryItemInput[];
}

export const TRIP_BASE_USER_PROMPT_TEMPLATE = `
You are given core trip data in JSON format:

{{trip_core_json}}

`;
