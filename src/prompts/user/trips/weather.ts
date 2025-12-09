import { TripCoreInput } from "./base";

export interface TripWeatherInput extends TripCoreInput {
  destination: string; // e.g. "Whistler, British Columbia, Canada"
  startDate: string; // ISO: "2026-02-15"
  endDate: string; // ISO: "2026-02-20"
  regionHint?: string; // Optional: "Pacific Northwest", "Alps", etc.
}

export const TRIP_WEATHER_USER_PROMPT_TEMPLATE = `
You are given structured trip weather input in JSON format:

{{trip_core_json}}

This JSON matches the following TypeScript type:

interface TripWeatherInput {
  destination: string;
  startDate: string;
  endDate: string;
  regionHint?: string;
}

Use ONLY this data and general seasonal knowledge to describe typical weather for this destination and time of year.

Follow this exact output format and nothing else:

Weather Snapshot:
- Temperatures: <one concise sentence with daytime and nighttime ranges in Fahrenheit>
- Precipitation: <one concise sentence about snow/rain and general conditions>
- Daylight: <one concise sentence about day length and seasonal feel>

Do not mention Celsius, real-time forecasts, or detailed safety risks.
`;
