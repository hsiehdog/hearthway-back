import { Request, Response, NextFunction } from "express";
import { GroupType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";

const createGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  type: z.nativeEnum(GroupType).optional(),
  memberDisplayName: z.string().min(1).max(200).optional(),
  memberEmail: z.string().email().optional(),
});

const getGroupParamsSchema = z.object({
  id: z.string().min(1, "Group id is required"),
});

export const createGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { name, type, memberDisplayName, memberEmail } = createGroupSchema.parse(req.body);

    const displayName = memberDisplayName ?? req.user.name ?? req.user.email ?? "Creator";
    const email = memberEmail ?? req.user.email ?? undefined;

    const group = await prisma.group.create({
      data: {
        name,
        type: type ?? GroupType.PROJECT,
        members: {
          create: {
            userId: req.user.id,
            displayName,
            email,
          },
        },
      },
      include: {
        members: true,
      },
    });

    res.status(201).json({ group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request body", 400, error.flatten()));
      return;
    }

    next(error);
  }
};

export const getGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = getGroupParamsSchema.parse(req.params);

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: true,
        expenses: {
          include: {
            participants: true,
            lineItems: true,
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!group) {
      throw new ApiError("Group not found", 404);
    }

    const isMember = group.members.some((member) => member.userId === req.user?.id);
    if (!isMember) {
      throw new ApiError("You are not a member of this group", 403);
    }

    res.json({ group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request", 400, error.flatten()));
      return;
    }

    next(error);
  }
};
