import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "./errorHandler";

export const requireGroupMember: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) return next(new ApiError("Unauthorized", 401));

    const { groupId } = req.params;
    if (!groupId) return next(new ApiError("groupId is required", 400));

    const groupMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: req.user.id,
      },
      select: {
        id: true,
        groupId: true,
        // role: true, // if you have roles
      },
    });

    if (groupMember) {
      req.groupMember = groupMember;
      return next();
    }

    const groupExists = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });

    if (!groupExists) return next(new ApiError("Group not found", 404));
    return next(new ApiError("You are not a member of this group", 403));
  } catch (err) {
    next(err);
  }
};
