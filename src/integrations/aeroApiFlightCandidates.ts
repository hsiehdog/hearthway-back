import { AIRLINES_BY_CODE } from "../constants/airlines";
import { fetchFlightSchedules, type AeroSchedule } from "./aeroApiClient";

export type ResolvedFlight = {
  airlineCode: string;
  airlineName: string | null;
  flightNumber: string;
  departureTime: Date;
  arrivalTime: Date | null;
  originCode: string | null;
  destinationCode: string | null;
  raw: unknown;
};

export async function fetchFlightScheduleCandidates(input: {
  airlineCode: string;
  airlineName?: string | null;
  flightNumber: string;
  departureDate: Date;
}): Promise<ResolvedFlight[]> {
  const schedules: AeroSchedule[] = await fetchFlightSchedules({
    airlineCode: input.airlineCode,
    flightNumber: input.flightNumber,
    departureDate: input.departureDate,
  });

  return schedules
    .map((s) => scheduleToResolvedFlight(s, input))
    .filter(Boolean) as ResolvedFlight[];
}

function scheduleToResolvedFlight(
  s: AeroSchedule,
  input: {
    airlineCode: string;
    airlineName?: string | null;
    flightNumber: string;
  }
): ResolvedFlight | null {
  const departureTime = s.scheduled_out ? new Date(s.scheduled_out) : null;
  if (!departureTime || Number.isNaN(departureTime.getTime())) return null;

  const arrival = s.scheduled_in ? new Date(s.scheduled_in) : null;

  const originCode =
    typeof s.origin_iata === "string"
      ? s.origin_iata.toUpperCase().trim()
      : null;
  const destinationCode =
    typeof s.destination_iata === "string"
      ? s.destination_iata.toUpperCase().trim()
      : null;

  // AeroSchedule typing is minimal; Aero often returns more fields.
  const anyS = s as any;

  const airlineName =
    anyS.operator ||
    anyS.airline_name ||
    input.airlineName ||
    AIRLINES_BY_CODE[input.airlineCode]?.name ||
    null;

  return {
    airlineCode: input.airlineCode,
    airlineName,
    flightNumber: input.flightNumber,
    departureTime,
    arrivalTime: arrival && !Number.isNaN(arrival.getTime()) ? arrival : null,
    originCode,
    destinationCode,
    raw: s,
  };
}
