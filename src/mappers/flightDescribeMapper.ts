import { AIRPORTS_BY_CODE } from "../constants/airports";
import { AIRLINES_BY_CODE } from "../constants/airlines";
import type { ResolvedFlight } from "../integrations/aeroApiFlightCandidates";

const formatDateLabel = (value: Date, timeZone?: string | null) =>
  value.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timeZone || undefined,
  });

const formatTimeLabel = (value: Date, timeZone?: string | null) =>
  value.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timeZone || undefined,
  });

export function describeFlight(
  flight: Pick<
    ResolvedFlight,
    | "airlineCode"
    | "airlineName"
    | "flightNumber"
    | "departureTime"
    | "arrivalTime"
    | "originCode"
    | "destinationCode"
  >
) {
  const airlineName =
    AIRLINES_BY_CODE[flight.airlineCode]?.name ??
    flight.airlineName ??
    flight.airlineCode;

  const originAirport = flight.originCode
    ? AIRPORTS_BY_CODE[flight.originCode]
    : undefined;
  const destinationAirport = flight.destinationCode
    ? AIRPORTS_BY_CODE[flight.destinationCode]
    : undefined;

  const startDate = formatDateLabel(
    flight.departureTime,
    originAirport?.timezone
  );
  const startTime = formatTimeLabel(
    flight.departureTime,
    originAirport?.timezone
  );

  const endDateLabel = flight.arrivalTime
    ? formatDateLabel(flight.arrivalTime, destinationAirport?.timezone)
    : null;
  const endTimeLabel = flight.arrivalTime
    ? formatTimeLabel(flight.arrivalTime, destinationAirport?.timezone)
    : null;

  const sameDate =
    endDateLabel && endDateLabel === startDate && Boolean(flight.arrivalTime);

  const originName = originAirport?.name ?? flight.originCode ?? "Origin";
  const destinationName =
    destinationAirport?.name ?? flight.destinationCode ?? "Destination";
  const originCode = flight.originCode ?? "UNK";
  const destinationCode = flight.destinationCode ?? "UNK";

  const datePortion = sameDate
    ? `on ${startDate} departing at ${startTime} and arriving at ${endTimeLabel}`
    : `departing on ${startDate} ${startTime}${
        endDateLabel && endTimeLabel
          ? ` and arriving on ${endDateLabel} ${endTimeLabel}`
          : ""
      }`;

  return `${airlineName} ${flight.flightNumber} from ${originName} (${originCode}) to ${destinationName} (${destinationCode}) ${datePortion}.`;
}

export function summarizeFlightOptions(
  flights: Array<
    Pick<
      ResolvedFlight,
      | "airlineCode"
      | "airlineName"
      | "flightNumber"
      | "departureTime"
      | "arrivalTime"
      | "originCode"
      | "destinationCode"
    >
  >,
  max = 5
) {
  return flights
    .slice(0, max)
    .map((f, idx) => `${idx + 1}. ${describeFlight(f)}`)
    .join("\n");
}
