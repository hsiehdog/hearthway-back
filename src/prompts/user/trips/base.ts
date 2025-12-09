export interface TripMemberInput {
  memberId: string;
  displayName?: string | null;
  email?: string | null;
  userId?: string | null;
}

export interface TripExpenseInput {
  expenseId: string;
  name: string;
  vendor?: string | null;
  description?: string | null;
  amount: number;
  currency: string;
  date: string; // ISO string
  status: string;
  splitType: string;
  participantCount?: number;
}

export interface TripExpenseSummaryInput {
  totalExpenses: number;
  totalsByCurrency: Array<{
    currency: string;
    total: number;
    count: number;
  }>;
  latestExpenseDate?: string | null;
}

export interface TripItineraryItemInput {
  id: string;
  type: string;
  title: string;
  status: string;
  startDateTime: string; // ISO string
  endDateTime?: string | null; // ISO string
  allDay?: boolean;
  locationName?: string | null;
  locationAddress?: string | null;
}

export interface TripCoreInput {
  tripId: string;
  tripName?: string;
  primaryLocation?: string | null;
  baseCurrency?: string | null;
  startDate?: string | null; // ISO string
  endDate?: string | null; // ISO string
  memberCount?: number;
  members?: TripMemberInput[];
  expenseSummary?: TripExpenseSummaryInput;
  expenses?: TripExpenseInput[];
  itinerary?: TripItineraryItemInput[];
}

export const TRIP_BASE_USER_PROMPT_TEMPLATE = `
Trip context arrives as JSON following the TripCoreInput type above.

Guidance:
- Dates are ISO 8601 strings; null means not provided.
- Expense lists may be truncated, but totalsByCurrency and totalExpenses give scale.
- Use only the provided data; call out gaps instead of inventing specifics.
`;
