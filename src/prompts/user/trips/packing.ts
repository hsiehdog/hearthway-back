import { TripCoreInput } from "./base";

export interface TripPackingInput extends TripCoreInput {
  destination: string; // "Whistler, British Columbia"
  startDate: string; // "2026-02-15"
  endDate: string; // "2026-02-20"
  primaryActivities?: string[]; // ["skiing", "snowboarding"]
  climateHint?: string; // "winter mountain"
}

export const TRIP_PACKING_USER_PROMPT_TEMPLATE = `
You are given structured trip packing input in JSON format:

{{trip_core_json}}

This JSON matches the following TypeScript type:

interface TripPackingInput {
  destination: string;
  startDate: string;
  endDate: string;
  primaryActivities?: string[];
  climateHint?: string;
}

Use ONLY this data and general seasonal knowledge to generate a concise packing checklist.

Follow this exact output format:

Packing Suggestions:
- Core clothing: <one concise sentence>
- Footwear: <one concise sentence>
- Activity gear: <one concise sentence>
- Weather accessories: <one concise sentence>
- Essentials & electronics: <one concise sentence>

Do not include:
- Long explanations
- Safety training notes
- Rental advice
- Conditional backcountry language
`;
