import env from "../config/env";
import { ApiError } from "../middleware/errorHandler";

export type AeroSchedule = {
  scheduled_out?: string;
  scheduled_in?: string;
  origin_iata?: string;
  destination_iata?: string;
  [key: string]: unknown;
};

const formatDateParam = (value: Date) => value.toISOString().slice(0, 10);

export async function fetchFlightSchedules(opts: {
  airlineCode: string;
  flightNumber: string;
  departureDate: Date;
}): Promise<AeroSchedule[]> {
  if (!env.AERO_API_URL)
    throw new ApiError("AERO_API_URL is not configured", 500);
  if (!env.AERO_API_KEY)
    throw new ApiError("AERO_API_KEY is not configured", 500);

  const startDate = formatDateParam(opts.departureDate);
  const endDate = formatDateParam(
    new Date(opts.departureDate.getTime() + 24 * 60 * 60 * 1000)
  );

  const baseUrl = env.AERO_API_URL.replace(/\/+$/, "");
  const url = `${baseUrl}/schedules/${startDate}/${endDate}?airline=${encodeURIComponent(
    opts.airlineCode
  )}&flight_number=${encodeURIComponent(opts.flightNumber)}`;

  const resp = await fetch(url, { headers: { "x-apikey": env.AERO_API_KEY } });
  if (!resp.ok) throw new ApiError("Failed to fetch flight data", resp.status);

  const payload = (await resp.json()) as unknown;

  // AeroAPI sometimes returns array, or { data }, or { scheduled }
  if (Array.isArray(payload)) return payload as AeroSchedule[];
  if (payload && typeof payload === "object") {
    const obj = payload as { data?: unknown; scheduled?: unknown };
    if (Array.isArray(obj.data)) return obj.data as AeroSchedule[];
    if (Array.isArray(obj.scheduled)) return obj.scheduled as AeroSchedule[];
  }
  return [];
}
