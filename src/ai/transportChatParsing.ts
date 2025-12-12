import { resolveAirline } from "../constants/airlines";

export type FlightRequest = {
  airlineCode?: string;
  airlineName?: string;
  flightNumber?: string;
  departureDate?: string;
  explicitDate?: string;
  departureDateHint?: string;
  passengers?: string[];
  passengerNames?: string[];
};

export type ParsedChat = {
  flightRequests: FlightRequest[];
  notes?: string;
};

export function normalize(v?: string | null) {
  return typeof v === "string" ? v.trim() : "";
}

export function parseLLMJson(text: string): ParsedChat | null {
  try {
    const parsed = JSON.parse(text) as ParsedChat;
    if (!parsed || !Array.isArray(parsed.flightRequests)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function resolveAirlineInfo(req: FlightRequest) {
  const airline = resolveAirline(
    normalize(req.airlineCode) || normalize(req.airlineName)
  );
  return {
    airlineCode: airline?.code ?? null,
    airlineName: airline?.name ?? null,
  };
}

export function selectDepartureDate(
  req: FlightRequest,
  tripStart?: string | null,
  tripEnd?: string | null
) {
  const explicit =
    normalize(req.explicitDate) || normalize(req.departureDate) || "";
  if (explicit) return explicit;

  const hint = normalize(req.departureDateHint).toUpperCase();
  if (hint === "TRIP_START" && tripStart) return tripStart;
  if (hint === "TRIP_END" && tripEnd) return tripEnd;
  return "";
}

export function buildCleanRequests(args: {
  flightRequests: FlightRequest[];
  tripStart: string | null;
  tripEnd: string | null;
}) {
  return args.flightRequests
    .map((req) => {
      const airline = resolveAirlineInfo(req);
      const departureDate = selectDepartureDate(
        req,
        args.tripStart,
        args.tripEnd
      );

      return {
        airlineCode: airline.airlineCode,
        airlineName: airline.airlineName,
        flightNumber: normalize(req.flightNumber),
        departureDate,
        passengers:
          req.passengers?.map((p) => p.trim()).filter(Boolean) ??
          req.passengerNames?.map((p) => p.trim()).filter(Boolean) ??
          [],
      };
    })
    .filter((r) => r.airlineCode && r.flightNumber && r.departureDate);
}
