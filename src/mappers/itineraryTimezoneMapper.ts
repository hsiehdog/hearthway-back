import { AIRPORTS_BY_CODE } from "../constants/airports";

export function enrichItineraryTimezones<
  T extends {
    originLocationCode: string | null;
    destinationLocationCode: string | null;
  }
>(item: T): T & { startTimeZone: string | null; endTimeZone: string | null } {
  const origin = item.originLocationCode
    ? AIRPORTS_BY_CODE[item.originLocationCode.toUpperCase()]
    : undefined;

  const destination = item.destinationLocationCode
    ? AIRPORTS_BY_CODE[item.destinationLocationCode.toUpperCase()]
    : undefined;

  return {
    ...item,
    startTimeZone: origin?.timezone ?? null,
    endTimeZone: destination?.timezone ?? null,
  };
}
