export const TRIP_WEATHER_USER_PROMPT_TEMPLATE = `
Use ONLY this data and general seasonal knowledge to describe typical weather for this destination and time of year.

Follow this exact output format and nothing else:

Weather Snapshot:
- Temperatures: <one concise sentence with daytime and nighttime ranges in Fahrenheit>
- Precipitation: <one concise sentence about snow/rain and general conditions>
- Daylight: <one concise sentence about day length and seasonal feel>

Do not mention Celsius, real-time forecasts, or detailed safety risks.
`;
