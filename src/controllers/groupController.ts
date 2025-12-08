import { Request, Response, NextFunction } from "express";
import { GroupType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { addParticipantCosts } from "../lib/expense";

const createGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  type: z.nativeEnum(GroupType).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  location: z.string().optional(),
});

const getGroupParamsSchema = z.object({
  id: z.string().min(1, "Group id is required"),
});

const createMemberSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(200, "Display name is too long"),
  email: z.string().email().optional(),
});

export const listGroups = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: req.user.id,
          },
        },
      },
      include: {
        members: true,
        expenses: {
          include: {
            participants: true,
            payments: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const groupsWithCosts = groups.map((group) => ({
      ...group,
      expenses: group.expenses.map(addParticipantCosts),
    }));

    res.json({ groups: groupsWithCosts });
  } catch (error) {
    next(error);
  }
};

export const createGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { name, type, startDate, endDate, location } = createGroupSchema.parse(req.body);

    const fallbackName = req.user.name ?? req.user.email ?? "Creator";
    const fallbackEmail = req.user.email ?? undefined;

    const group = await prisma.group.create({
      data: {
        name,
        type: type ?? GroupType.PROJECT,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        primaryLocation: location || undefined,
        members: {
          create: {
            userId: req.user.id,
            displayName: fallbackName,
            email: fallbackEmail,
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
            payments: true,
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

    res.json({
      group: {
        ...group,
        expenses: group.expenses.map(addParticipantCosts),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request", 400, error.flatten()));
      return;
    }

    next(error);
  }
};

export const addGroupMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = getGroupParamsSchema.parse(req.params);
    const { displayName, email } = createMemberSchema.parse(req.body);

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: true,
      },
    });

    if (!group) {
      throw new ApiError("Group not found", 404);
    }

    const isMember = group.members.some((member) => member.userId === req.user?.id);
    if (!isMember) {
      throw new ApiError("You are not a member of this group", 403);
    }

    await prisma.groupMember.create({
      data: {
        groupId: id,
        displayName,
        email,
      },
    });

    const updatedGroup = await prisma.group.findUnique({
      where: { id },
      include: {
        members: true,
        expenses: {
          include: {
            participants: true,
            payments: true,
          },
        },
      },
    });

    res.status(201).json({
      group: updatedGroup
        ? {
            ...updatedGroup,
            expenses: updatedGroup.expenses.map(addParticipantCosts),
          }
        : updatedGroup,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request body", 400, error.flatten()));
      return;
    }

    next(error);
  }
};
