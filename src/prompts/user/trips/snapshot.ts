import { TripCoreInput } from "./base";

export interface TripSnapshotInput extends TripCoreInput {
  // Optional hints if you have them
  tripName?: string; // "Whistler Ski Trip"
  primaryActivities?: string[]; // ["skiing", "snowboarding", "village nightlife"]
}

export const TRIP_SNAPSHOT_USER_PROMPT_TEMPLATE = `
You are given core trip data in JSON format:

{{trip_core_json}}

This JSON matches the following TypeScript type:

interface TripSnapshotInput extends TripCoreInput {
  tripName?: string;
  primaryActivities?: string[];
}

Use ONLY this data to generate:
- A short Trip Overview (2–3 sentences)
- A short Trip Vibe phrase
- 3–5 high-level planning reminders

Follow this output format exactly:

Trip Overview:
<paragraph>

Trip Vibe:
<short phrase>

Planning Posture:
- Bullet
- Bullet
- Bullet
`;
