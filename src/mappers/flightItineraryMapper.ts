import {
  Prisma,
  TripItineraryItemStatus,
  TripItineraryItemType,
  TripLocationType,
  TripTransportMode,
} from "@prisma/client";
import { AIRLINES_BY_CODE } from "../constants/airlines";
import { AIRPORTS_BY_CODE } from "../constants/airports";
import { ApiError } from "../middleware/errorHandler";
import type { AeroSchedule } from "../integrations/aeroApiClient";

export function buildFlightCreateInput(args: {
  groupId: string;
  flight: AeroSchedule;
  airlineCode: string; // normalized (e.g. "UA")
  flightNumber: string; // normalized (e.g. "552")
  memberIds: string[];
}): Prisma.TripItineraryItemCreateArgs["data"] {
  const departureTime = args.flight.scheduled_out
    ? new Date(args.flight.scheduled_out)
    : null;
  if (!departureTime || Number.isNaN(departureTime.getTime())) {
    throw new ApiError("Flight data is missing a valid departure time", 422);
  }

  const arrivalTime = args.flight.scheduled_in
    ? new Date(args.flight.scheduled_in)
    : undefined;
  const parsedArrival =
    arrivalTime && !Number.isNaN(arrivalTime.getTime())
      ? arrivalTime
      : undefined;

  const originCode = args.flight.origin_iata?.toUpperCase().trim();
  const destinationCode = args.flight.destination_iata?.toUpperCase().trim();

  const originAirport = originCode ? AIRPORTS_BY_CODE[originCode] : undefined;
  const destinationAirport = destinationCode
    ? AIRPORTS_BY_CODE[destinationCode]
    : undefined;

  const airline = AIRLINES_BY_CODE[args.airlineCode];

  return {
    groupId: args.groupId,
    type: TripItineraryItemType.FLIGHT,
    status: TripItineraryItemStatus.CONFIRMED,
    title: `${airline?.name ?? args.airlineCode} ${args.flightNumber}`,

    transportMode: TripTransportMode.FLIGHT,
    startDateTime: departureTime,
    endDateTime: parsedArrival,

    originLocationCode: originCode,
    originLocationType: originCode ? TripLocationType.AIRPORT : undefined,
    originName: originAirport?.name ?? originCode ?? undefined,
    originAddress: originAirport?.city
      ? `${originAirport.city}${
          originAirport.country ? `, ${originAirport.country}` : ""
        }`
      : undefined,

    destinationLocationCode: destinationCode,
    destinationLocationType: destinationCode
      ? TripLocationType.AIRPORT
      : undefined,
    destinationName: destinationAirport?.name ?? destinationCode ?? undefined,
    destinationAddress: destinationAirport?.city
      ? `${destinationAirport.city}${
          destinationAirport.country ? `, ${destinationAirport.country}` : ""
        }`
      : undefined,

    transportNumber: `${args.airlineCode}${args.flightNumber}`,
    airlineCode: args.airlineCode,
    airlineName: airline?.name,
    flightNumber: args.flightNumber,

    rawTransportPayload: JSON.parse(JSON.stringify(args.flight)),

    memberAssignments: args.memberIds.length
      ? { create: args.memberIds.map((memberId) => ({ memberId })) }
      : undefined,
  };
}
