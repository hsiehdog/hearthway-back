import { Request, Response, NextFunction } from "express";
import { Prisma, SplitType, ExpenseStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { deleteFromS3, generateSignedGetUrl } from "../lib/storage";

const participantSchema = z.object({
  memberId: z.string().min(1, "memberId is required"),
  shareAmount: z.coerce.number().nonnegative().optional(),
});

const lineItemSchema = z.object({
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  quantity: z.coerce.number().positive().default(1),
  unitAmount: z.coerce.number().nonnegative(),
  totalAmount: z.coerce.number(),
});

const expenseParamsSchema = z.object({
  id: z.string().min(1, "expense id is required"),
});

const createExpenseSchema = z.object({
  groupId: z.string().min(1, "groupId is required"),
  payerMemberId: z.string().min(1, "payerMemberId is required").optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  amount: z.coerce.number().positive("amount must be positive"),
  currency: z.string().min(1).max(10).default("USD"),
  date: z.coerce.date().optional(),
  category: z.string().max(100).optional(),
  note: z.string().max(1000).optional(),
  splitType: z.nativeEnum(SplitType),
  participants: z.array(participantSchema).optional(),
  percentMap: z
    .record(z.string(), z.number().nonnegative())
    .optional(),
  shareMap: z
    .record(z.string(), z.number().nonnegative())
    .optional(),
  receiptUrl: z.string().url().optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

const updateExpenseSchema = z.object({
  payerMemberId: z.string().min(1, "payerMemberId is required").optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  amount: z.coerce.number().positive("amount must be positive").optional(),
  currency: z.string().min(1).max(10).optional(),
  date: z.coerce.date().optional(),
  category: z.string().max(100).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  splitType: z.nativeEnum(SplitType).optional(),
  participants: z.array(participantSchema).optional(),
  percentMap: z
    .record(z.string(), z.number().nonnegative())
    .optional()
    .nullable(),
  shareMap: z
    .record(z.string(), z.number().nonnegative())
    .optional()
    .nullable(),
  receiptUrl: z.string().url().optional().nullable(),
  lineItems: z.array(lineItemSchema).optional(),
});

export const createExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const {
      groupId,
      payerMemberId,
      amount,
      currency,
      date,
      category,
      note,
      status,
      splitType,
      participants,
      percentMap,
      shareMap,
      receiptUrl,
      lineItems,
    } = createExpenseSchema.parse(req.body);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new ApiError("Group not found", 404);
    }

    const creatorMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: req.user.id,
      },
    });

    if (!creatorMembership) {
      throw new ApiError("You are not a member of this group", 403);
    }

    let resolvedPayerId: string | null = payerMemberId ?? null;
    if (payerMemberId) {
      const payerMembership = await prisma.groupMember.findFirst({
        where: { id: payerMemberId, groupId },
      });

      if (!payerMembership) {
        throw new ApiError("Payer is not part of this group", 400);
      }

      resolvedPayerId = payerMembership.id;
    }

    const resolvedStatus = status ?? (resolvedPayerId ? ExpenseStatus.PAID : ExpenseStatus.PENDING);

    const participantIds = participants?.map((p) => p.memberId) ?? [];
    const hasDuplicates = new Set(participantIds).size !== participantIds.length;
    if (hasDuplicates) {
      throw new ApiError("Duplicate participant memberIds are not allowed", 400);
    }

    if (participantIds.length > 0) {
      const groupParticipants = await prisma.groupMember.findMany({
        where: {
          groupId,
          id: { in: participantIds },
        },
        select: { id: true },
      });

      const validIds = new Set(groupParticipants.map((p) => p.id));
      const missing = participantIds.filter((id) => !validIds.has(id));
      if (missing.length) {
        throw new ApiError("Some participants are not part of this group", 400, { missing });
      }
    }

    const expense = await prisma.expense.create({
      data: {
        groupId,
        payerId: resolvedPayerId ?? undefined,
        status: resolvedStatus,
        amount: new Prisma.Decimal(amount),
        currency,
        date: date ?? new Date(),
        category,
        note,
        splitType,
        percentMap: percentMap ? (percentMap as Prisma.InputJsonValue) : undefined,
        shareMap: shareMap ? (shareMap as Prisma.InputJsonValue) : undefined,
        receiptUrl,
        participants: participants?.length
          ? {
              create: participants.map((participant) => ({
                memberId: participant.memberId,
                shareAmount:
                  participant.shareAmount !== undefined ? new Prisma.Decimal(participant.shareAmount) : undefined,
              })),
            }
          : undefined,
        lineItems: lineItems?.length
          ? {
              create: lineItems.map((item) => ({
                description: item.description,
                category: item.category,
                quantity: new Prisma.Decimal(item.quantity),
                unitAmount: new Prisma.Decimal(item.unitAmount),
                totalAmount: new Prisma.Decimal(item.totalAmount),
              })),
            }
          : undefined,
      },
      include: {
        participants: true,
        lineItems: true,
      },
    });

    res.status(201).json({ expense });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request body", 400, error.flatten()));
      return;
    }

    next(error);
  }
};

export const updateExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = req.params;
    const {
      payerMemberId,
      amount,
      currency,
      date,
      category,
      note,
      status,
      splitType,
      participants,
      percentMap,
      shareMap,
      receiptUrl,
      lineItems,
    } = updateExpenseSchema.parse(req.body);

    const existingExpense = await prisma.expense.findUnique({
      where: { id },
      include: {
        group: {
          include: { members: true },
        },
        participants: true,
        lineItems: true,
      },
    });

    if (!existingExpense) {
      throw new ApiError("Expense not found", 404);
    }

    const isMember = existingExpense.group.members.some((member) => member.userId === req.user?.id);
    if (!isMember) {
      throw new ApiError("You are not a member of this group", 403);
    }

    let resolvedPayerId: string | null = payerMemberId ?? existingExpense.payerId;
    if (payerMemberId) {
      const payerMembership = await prisma.groupMember.findFirst({
        where: { id: payerMemberId, groupId: existingExpense.groupId },
      });

      if (!payerMembership) {
        throw new ApiError("Payer is not part of this group", 400);
      }

      resolvedPayerId = payerMembership.id;
    }

    const participantIds = participants?.map((p) => p.memberId) ?? [];
    if (participantIds.length > 0) {
      const groupParticipants = await prisma.groupMember.findMany({
        where: {
          groupId: existingExpense.groupId,
          id: { in: participantIds },
        },
        select: { id: true },
      });

      const validIds = new Set(groupParticipants.map((p) => p.id));
      const missing = participantIds.filter((pid) => !validIds.has(pid));
      if (missing.length) {
        throw new ApiError("Some participants are not part of this group", 400, { missing });
      }
    }

    const resolvedStatus = status ?? (resolvedPayerId ? ExpenseStatus.PAID : ExpenseStatus.PENDING);

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        payerId: resolvedPayerId ?? null,
        status: resolvedStatus,
        amount: amount !== undefined ? new Prisma.Decimal(amount) : undefined,
        currency,
        date,
        category,
        note,
        splitType,
        percentMap: percentMap === null ? Prisma.DbNull : (percentMap as Prisma.InputJsonValue | undefined),
        shareMap: shareMap === null ? Prisma.DbNull : (shareMap as Prisma.InputJsonValue | undefined),
        receiptUrl,
        participants: participants
          ? {
              deleteMany: { expenseId: id },
              create: participants.map((participant) => ({
                memberId: participant.memberId,
                shareAmount:
                  participant.shareAmount !== undefined ? new Prisma.Decimal(participant.shareAmount) : undefined,
              })),
            }
          : undefined,
        lineItems: lineItems
          ? {
              deleteMany: { expenseId: id },
              create: lineItems.map((item) => ({
                description: item.description,
                category: item.category,
                quantity: new Prisma.Decimal(item.quantity),
                unitAmount: new Prisma.Decimal(item.unitAmount),
                totalAmount: new Prisma.Decimal(item.totalAmount),
              })),
            }
          : undefined,
      },
      include: {
        participants: true,
        lineItems: true,
      },
    });

    res.json({ expense: updatedExpense });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request body", 400, error.flatten()));
      return;
    }

    next(error);
  }
};

export const getExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = expenseParamsSchema.parse(req.params);

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        group: {
          members: {
            some: { userId: req.user.id },
          },
        },
      },
      include: {
        participants: true,
        lineItems: true,
        uploads: true,
      },
    });

    if (!expense) {
      throw new ApiError("Expense not found", 404);
    }

    const uploadsWithSignedUrl = await Promise.all(
      expense.uploads.map(async (upload) => ({
        ...upload,
        signedUrl: await generateSignedGetUrl(upload.storageKey, 300),
        signedUrlExpiresIn: 300,
      })),
    );

    res.json({
      expense: {
        ...expense,
        uploads: uploadsWithSignedUrl,
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

export const deleteExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = req.params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        group: {
          include: { members: true },
        },
      },
    });

    if (!expense) {
      throw new ApiError("Expense not found", 404);
    }

    const isMember = expense.group.members.some((member) => member.userId === req.user?.id);
    if (!isMember) {
      throw new ApiError("You are not a member of this group", 403);
    }

    const uploads = await prisma.uploadedExpense.findMany({
      where: { expenseId: id },
      select: { id: true, storageKey: true },
    });

    await prisma.$transaction([
      prisma.uploadedExpense.deleteMany({ where: { expenseId: id } }),
      prisma.expenseParticipant.deleteMany({ where: { expenseId: id } }),
      prisma.expenseLineItem.deleteMany({ where: { expenseId: id } }),
      prisma.expense.delete({ where: { id } }),
    ]);

    await Promise.all(
      uploads.map(({ storageKey }) =>
        deleteFromS3(storageKey).catch(() => {
          // swallow S3 delete errors to avoid blocking API response
          return;
        }),
      ),
    );

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
