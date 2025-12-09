import { TripCoreInput } from "./base";

export interface TripPackingInput extends TripCoreInput {
  primaryActivities?: string[]; // ["skiing", "fine dining"]
  lodgingTypeHint?: string; // "resort", "city hotel", "apartment", "cabin"
}

export const TRIP_PACKING_USER_PROMPT_TEMPLATE = `
You are given core trip data in JSON format:

{{trip_core_json}}

This JSON matches the following TypeScript type:

interface TripPackingInput extends TripCoreInput {
  primaryActivities?: string[];
  lodgingTypeHint?: string;
}

Use this data to suggest practical packing guidance, focusing on clothing layers, footwear, weather-related gear, and activity-specific items.

Do NOT mention specific brands or encourage purchases.

Output format:

Packing Suggestions:
- Bullet
- Bullet
- Bullet
`;
