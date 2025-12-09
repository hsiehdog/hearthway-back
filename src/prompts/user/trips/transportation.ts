export const TRIP_TRANSPORTATION_USER_PROMPT_TEMPLATE = `
/*
If description is present, use it to refine the recommendations:
- Lean car-free if the traveler mentions walkability, relaxation, or urban exploration.
- Lean driving or shuttle options if flexibility, remoteness, or outdoor access is emphasized.
- Lean toward simple, shared solutions for group trips.
*/

Use ONLY the provided data and general geographic and seasonal knowledge to write a concise and opinionated transportation plan.

Follow this exact structure:

Transportation:
Getting there:
<2–3 sentences>

Getting around:
<2–3 sentences>

Heading home:
<2–3 sentences>

Each section must provide practical recommendations, not just descriptions.
When referencing airports, include the airport code.
Vendor mentions are allowed if they are widely recognized.
Do not include prices, schedules, booking sites, or real-time conditions.
`;
