import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";

export async function assertMembersBelongToGroup(
  groupId: string,
  memberIds: string[]
) {
  if (!memberIds.length) return;

  const found = await prisma.groupMember.findMany({
    where: { groupId, id: { in: memberIds } },
    select: { id: true },
  });

  const valid = new Set(found.map((m) => m.id));
  const missingIds = memberIds.filter((id) => !valid.has(id));

  if (missingIds.length) {
    throw new ApiError("Member not found in this group", 404, { missingIds });
  }
}
