import { TripCoreInput } from "./base";

export interface TripCurrencyInput extends TripCoreInput {
  destination: string; // "Nashville, Tennessee, USA"
  destinationCountryCode?: string; // "US", "CA", "JP", etc.
  homeCountryCode?: string; // "US", "GB", etc.
}

export const TRIP_CURRENCY_USER_PROMPT_TEMPLATE = `
You are given structured trip currency input in JSON format:

{{trip_core_json}}

This JSON matches the following TypeScript type:

interface TripCurrencyInput {
  destination: string;
  destinationCountryCode?: string;
  homeCountryCode?: string;
}

Use ONLY this data and general knowledge to describe:
- The local currency
- How commonly cards vs cash are used
- Whether tipping or service charges are customary

Follow this exact output format:

Currency & Payments:
- Local currency: <one concise sentence>
- Cards vs cash: <one concise sentence>
- Tipping: <one concise sentence>

Do not include itemized tipping by role, dollar amounts, ATM advice, or warnings about fraud.
`;
