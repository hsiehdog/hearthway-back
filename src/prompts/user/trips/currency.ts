import { TripCoreInput } from "./base";

export interface TripCurrencyInput extends TripCoreInput {
  destinationCountryCode?: string; // "CA", "US", "JP", etc.
  homeCountryCode?: string; // "US", "GB", etc.
}

export const TRIP_CURRENCY_USER_PROMPT_TEMPLATE = `
You are given core trip data in JSON format:

{{trip_core_json}}

This JSON matches the following TypeScript type:

interface TripCurrencyInput extends TripCoreInput {
  destinationCountryCode?: string;
  homeCountryCode?: string;
}

Use this data to describe:
- The likely local currency
- General card vs cash norms
- Typical tipping expectations (where applicable)

Do NOT give exchange rates or legal/tax advice.

Output format:

Currency & Payments:
- Bullet
- Bullet
- Bullet
`;
