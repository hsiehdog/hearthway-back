export const TRIP_TRANSPORTATION_USER_PROMPT_TEMPLATE = `
Use ONLY this data and general geographic and seasonal knowledge to write a concise, opinionated transportation plan.

You must reference actual itinerary items when they exist. For example:
- If there is a confirmed flight, describe the trip using that flight’s airports and general context.
- If there are multiple transport legs, incorporate their sequence into your reasoning.
- If no itinerary items exist for a section, infer a reasonable mode of travel from origin, destination, and environment.

Follow this exact output structure:

Transportation:
Getting there:
<2–3 sentences that reference the traveler’s origin, the trip’s destination, and any relevant “arrival” itinerary items. If a flight exists, describe why it is the natural or practical option. If not, describe the default likely mode based on distance and geography.>

Getting around:
<2–3 sentences that reflect local geography, density, terrain, and any intra-trip transportation items. Reference cars, shuttles, transit, or walking only when appropriate for the region. If itinerary items include local transport, incorporate them.>

Heading home:
<2–3 sentences that reference any “return” itinerary items (e.g., flights departing from YVR back to SFO). If itinerary data is missing, default to the most practical outbound-in-reverse option.>

Rules:
- Always include airport codes when referencing airports.
- Use widely recognized transportation vendors only when helpful.
- Do not include prices, schedules, or booking-site recommendations.
- Do not invent details not implied by the trip data.

`;
