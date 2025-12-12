import { ApiError } from "../middleware/errorHandler";
import { fetchFlightSchedules, type AeroSchedule } from "./aeroApiClient";

export async function fetchFirstFlightMatch(opts: {
  airlineCode: string;
  flightNumber: string;
  departureDate: Date;
}): Promise<AeroSchedule> {
  const flights = await fetchFlightSchedules(opts);

  if (!flights.length) {
    throw new ApiError(
      "No flight schedule found for the provided details",
      404
    );
  }

  const flight = flights[0]!;
  const dep = flight.scheduled_out ? new Date(flight.scheduled_out) : null;

  if (!dep || Number.isNaN(dep.getTime())) {
    throw new ApiError("Flight data is missing a valid departure time", 422);
  }

  return flight;
}
