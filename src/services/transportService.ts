import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { assertMembersBelongToGroup } from "../auth/groupMembers";
import { fetchFirstFlightMatch } from "../integrations/aeroApiFlights";
import { buildFlightCreateInput } from "../mappers/flightItineraryMapper";
import { enrichItineraryTimezones } from "../mappers/itineraryTimezoneMapper";
import { TripItineraryItemType } from "@prisma/client";

export async function createFlightItineraryItem(input: {
  groupId: string;
  airlineCode: string;
  flightNumber: string;
  departureDate: Date;
  memberIds: string[];
}) {
  const memberIds = dedupeOrThrow(input.memberIds);

  // Validate target members belong to this group (also catches “member not found in group”)
  await assertMembersBelongToGroup(input.groupId, memberIds);

  const normalizedAirline = normalizeAirline(input.airlineCode);
  const normalizedFlightNumber = normalizeFlightNumber(input.flightNumber);

  const flight = await fetchFirstFlightMatch({
    airlineCode: normalizedAirline,
    flightNumber: normalizedFlightNumber,
    departureDate: input.departureDate,
  });

  const data = buildFlightCreateInput({
    groupId: input.groupId,
    flight,
    airlineCode: normalizedAirline,
    flightNumber: normalizedFlightNumber,
    memberIds,
  });

  return prisma.tripItineraryItem.create({
    data,
    include: { memberAssignments: true },
  });
}

export async function getMemberTransport(input: {
  groupId: string;
  memberId: string;
}) {
  // Proves memberId is in groupId; also returns a better 404 than “empty list”
  await assertMembersBelongToGroup(input.groupId, [input.memberId]);

  const assignments = await prisma.tripItineraryItemAssignment.findMany({
    where: {
      memberId: input.memberId,
      itineraryItem: {
        groupId: input.groupId,
        type: {
          in: [TripItineraryItemType.FLIGHT, TripItineraryItemType.TRANSPORT],
        },
      },
    },
    include: { itineraryItem: true },
    orderBy: { itineraryItem: { startDateTime: "asc" } },
  });

  return assignments.map(({ itineraryItem }) =>
    enrichItineraryTimezones(itineraryItem)
  );
}

// ---------- tiny helpers ----------
function dedupeOrThrow(ids: string[]) {
  const unique = Array.from(new Set(ids));
  if (unique.length !== ids.length) {
    throw new ApiError("Duplicate memberIds are not allowed", 400);
  }
  return unique;
}

const normalizeAirline = (v: string) => v.trim().toUpperCase();
const normalizeFlightNumber = (v: string) => v.trim();
