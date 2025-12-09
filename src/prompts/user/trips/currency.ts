export const TRIP_CURRENCY_USER_PROMPT_TEMPLATE = `
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
