import { NextFunction, Request, Response } from "express";
import {
  TripItineraryItemStatus,
  TripItineraryItemType,
  TripLocationType,
  TripTransportMode,
} from "@prisma/client";
import { z } from "zod";
import env from "../config/env";
import { AIRLINES_BY_CODE } from "../constants/airlines";
import { AIRPORTS_BY_CODE } from "../constants/airports";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";

type AeroSchedule = {
  scheduled_out?: string;
  scheduled_in?: string;
  origin_iata?: string;
  destination_iata?: string;
  [key: string]: unknown;
};

const paramsSchema = z.object({
  groupId: z.string().min(1, "groupId is required"),
});

const bodySchema = z.object({
  airlineCode: z.string().min(2, "airlineCode is required").max(3),
  flightNumber: z.string().min(1, "flightNumber is required").max(10),
  departureDate: z.coerce.date(),
  memberIds: z.array(z.string().min(1)).default([]),
});

const memberTransportParamsSchema = z.object({
  groupId: z.string().min(1, "groupId is required"),
  memberId: z.string().min(1, "memberId is required"),
});

const formatDateParam = (value: Date): string => value.toISOString().slice(0, 10);

export const createFlightItineraryItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    if (!env.AERO_API_URL) {
      throw new ApiError("AERO_API_URL is not configured", 500);
    }
    if (!env.AERO_API_KEY) {
      throw new ApiError("AERO_API_KEY is not configured", 500);
    }

    const { groupId } = paramsSchema.parse(req.params);
    const { airlineCode, flightNumber, departureDate, memberIds } =
      bodySchema.parse(req.body);

    const normalizedAirline = airlineCode.trim().toUpperCase();
    const normalizedFlightNumber = flightNumber.trim();

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      throw new ApiError("Group not found", 404);
    }

    const isMember = group.members.some(
      (member) => member.userId === req.user?.id
    );
    if (!isMember) {
      throw new ApiError("You are not a member of this group", 403);
    }

    const uniqueMemberIds = Array.from(new Set(memberIds));
    if (uniqueMemberIds.length !== memberIds.length) {
      throw new ApiError("Duplicate memberIds are not allowed", 400);
    }

    if (uniqueMemberIds.length) {
      const groupMembers = await prisma.groupMember.findMany({
        where: { groupId, id: { in: uniqueMemberIds } },
        select: { id: true },
      });

      const validIds = new Set(groupMembers.map((member) => member.id));
      const missingIds = uniqueMemberIds.filter((id) => !validIds.has(id));
      if (missingIds.length > 0) {
        throw new ApiError("Some memberIds are not part of this group", 400, {
          missingIds,
        });
      }
    }

    const startDate = formatDateParam(departureDate);
    const endDate = formatDateParam(
      new Date(departureDate.getTime() + 24 * 60 * 60 * 1000)
    );

    const baseUrl = env.AERO_API_URL.replace(/\/+$/, "");
    const url = `${baseUrl}/schedules/${startDate}/${endDate}?airline=${encodeURIComponent(
      normalizedAirline
    )}&flight_number=${encodeURIComponent(normalizedFlightNumber)}`;

    const response = await fetch(url, {
      headers: {
        "x-apikey": env.AERO_API_KEY,
      },
    });
    if (!response.ok) {
      throw new ApiError("Failed to fetch flight data", response.status);
    }
    console.log("AERO API response:", response);
    const payload = (await response.json()) as unknown;
    const flights: AeroSchedule[] = (() => {
      if (Array.isArray(payload)) return payload;
      if (payload && typeof payload === "object") {
        const withData = payload as { data?: unknown; scheduled?: unknown };
        if (Array.isArray(withData.data)) return withData.data as AeroSchedule[];
        if (Array.isArray(withData.scheduled)) return withData.scheduled as AeroSchedule[];
      }
      return [];
    })();

    if (!flights.length) {
      throw new ApiError(
        "No flight schedule found for the provided details",
        404
      );
    }

    const flight = flights[0]!;
    const departureTime = flight.scheduled_out
      ? new Date(flight.scheduled_out)
      : null;
    const arrivalTime = flight.scheduled_in
      ? new Date(flight.scheduled_in)
      : null;

    if (!departureTime || Number.isNaN(departureTime.getTime())) {
      throw new ApiError("Flight data is missing a valid departure time", 422);
    }

    const parsedArrival =
      arrivalTime && !Number.isNaN(arrivalTime.getTime())
        ? arrivalTime
        : undefined;

    const originCode = flight.origin_iata?.toUpperCase().trim();
    const destinationCode = flight.destination_iata?.toUpperCase().trim();
    const originAirport = originCode ? AIRPORTS_BY_CODE[originCode] : undefined;
    const destinationAirport = destinationCode
      ? AIRPORTS_BY_CODE[destinationCode]
      : undefined;
    const airline = AIRLINES_BY_CODE[normalizedAirline];

    const itineraryItem = await prisma.tripItineraryItem.create({
      data: {
        groupId,
        type: TripItineraryItemType.FLIGHT,
        status: TripItineraryItemStatus.CONFIRMED,
        title: `${
          airline?.name ?? normalizedAirline
        } ${normalizedFlightNumber}`,
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
        destinationName:
          destinationAirport?.name ?? destinationCode ?? undefined,
        destinationAddress: destinationAirport?.city
          ? `${destinationAirport.city}${
              destinationAirport.country
                ? `, ${destinationAirport.country}`
                : ""
            }`
          : undefined,
        transportNumber: `${normalizedAirline}${normalizedFlightNumber}`,
        airlineCode: normalizedAirline,
        airlineName: airline?.name,
        flightNumber: normalizedFlightNumber,
        rawTransportPayload: JSON.parse(JSON.stringify(flight)),
        memberAssignments: uniqueMemberIds.length
          ? {
              create: uniqueMemberIds.map((memberId) => ({
                memberId,
              })),
            }
          : undefined,
      },
      include: { memberAssignments: true },
    });

    res.status(201).json({ itineraryItem });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request", 400, error.flatten()));
      return;
    }

    next(error);
  }
};

export const getMemberTransport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { groupId, memberId } = memberTransportParamsSchema.parse(req.params);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      throw new ApiError("Group not found", 404);
    }

    const isMember = group.members.some((member) => member.userId === req.user?.id);
    if (!isMember) {
      throw new ApiError("You are not a member of this group", 403);
    }

    const targetMember = group.members.find((member) => member.id === memberId);
    if (!targetMember) {
      throw new ApiError("Member not found in this group", 404);
    }

    const assignments = await prisma.tripItineraryItemAssignment.findMany({
      where: {
        memberId,
        itineraryItem: {
          groupId,
          type: {
            in: [TripItineraryItemType.FLIGHT, TripItineraryItemType.TRANSPORT],
          },
        },
      },
      include: {
        itineraryItem: true,
      },
      orderBy: {
        itineraryItem: { startDateTime: "asc" },
      },
    });

    const transports = assignments.map((assignment) => {
      const item = assignment.itineraryItem;
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
    });
    res.json({ transports });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request", 400, error.flatten()));
      return;
    }

    next(error);
  }
};
