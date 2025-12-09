export const TRIP_SNAPSHOT_USER_PROMPT_TEMPLATE = `
Use ONLY this data and general seasonal knowledge to generate three sections: Trip Overview, Trip Vibe, and Planning Posture.

Trip Overview:
- 2–3 sentences.
- Describe the destination, time of year, and general nature of the trip.

Trip Vibe:
- A short, 2–5 word phrase describing how the trip will feel.

Planning Posture:
- 3–5 concise, actionable bullets.
- Each bullet should describe a specific step the traveler should take (e.g., what to book early, what to confirm, how to structure the trip).
- Focus on concrete planning actions, not generic budgeting advice or warnings about fees.

Follow this exact output format:

Trip Overview:
<2–3 sentence paragraph>

Trip Vibe:
<2–5 word phrase>

Planning Posture:
- Bullet
- Bullet
- Bullet
- (Optional bullets 4–5)

Do not mention:
- App state
- Missing data
- Whether lodging, expenses, or itinerary exist
- Solo vs group unless travelersCount is explicitly provided and > 1.
`;
