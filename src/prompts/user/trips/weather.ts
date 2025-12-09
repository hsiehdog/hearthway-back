import { TripCoreInput } from "./base";

export interface TripWeatherInput extends TripCoreInput {
  // optional: hemisphere or region hints if you want
  regionHint?: string; // "Pacific Northwest", "Alps", "Mediterranean"
}

export const TRIP_WEATHER_USER_PROMPT_TEMPLATE = `
You are given core trip data in JSON format:

{{trip_core_json}}

This JSON matches the following TypeScript type:

interface TripWeatherInput extends TripCoreInput {
  regionHint?: string;
}

Use this data to describe general seasonal weather expectations for the destination and time of year.

Do NOT use real-time forecasts. Use only typical or average conditions for that location and time of year.

Output format:

Weather Snapshot:
- Bullet
- Bullet
- Bullet
`;
