import { Request, Response, NextFunction } from "express";
import { Prisma, SplitType, ExpenseStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { deleteFromS3, generateSignedGetUrl } from "../lib/storage";
import { addParticipantCosts } from "../lib/expense";

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
  status: z.nativeEnum(ExpenseStatus).optional(),
  amount: z.coerce.number().positive("amount must be positive"),
  currency: z.string().min(1).max(10).default("USD"),
  date: z.coerce.date().optional(),
  name: z.string().min(1).max(200),
  vendor: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  splitType: z.nativeEnum(SplitType),
  participants: z.array(participantSchema).optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

const updateExpenseSchema = z.object({
  status: z.nativeEnum(ExpenseStatus).optional(),
  amount: z.coerce.number().positive("amount must be positive").optional(),
  currency: z.string().min(1).max(10).optional(),
  date: z.coerce.date().optional(),
  name: z.string().min(1).max(200).optional(),
  vendor: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  splitType: z.nativeEnum(SplitType).optional(),
  participants: z.array(participantSchema).optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

const payExpenseSchema = z.object({
  amount: z.coerce.number().positive("Payment amount must be positive"),
  payerMemberId: z.string().min(1, "payerMemberId is required"),
  notes: z.string().max(500).optional().nullable(),
  paidAt: z.coerce.date().optional(),
  receiptUrl: z.string().url().optional(),
});

export const createExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const {
      groupId,
      amount,
      currency,
      date,
      name,
      vendor,
      description,
      status,
      splitType,
      participants,
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

    const resolvedStatus = status ?? ExpenseStatus.PENDING;

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
        status: resolvedStatus,
        amount: new Prisma.Decimal(amount),
        currency,
        date: date ?? new Date(),
        name,
        vendor,
        description,
        splitType,
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
        payments: true,
      },
    });

    res.status(201).json({ expense: addParticipantCosts(expense) });
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
      amount,
      currency,
      date,
      name,
      vendor,
      description,
      status,
      splitType,
      participants,
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

    const resolvedStatus = status ?? existingExpense.status ?? ExpenseStatus.PENDING;

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: {
        status: resolvedStatus,
        amount: amount !== undefined ? new Prisma.Decimal(amount) : undefined,
        currency,
        date,
        name,
        vendor,
        description,
        splitType,
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
        payments: true,
      },
    });

    res.json({ expense: addParticipantCosts(updatedExpense) });
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
        payments: true,
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
      expense: addParticipantCosts({
        ...expense,
        uploads: uploadsWithSignedUrl,
      }),
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

export const deleteExpensePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id: expenseId, paymentId } = req.params;
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, group: { members: { some: { userId: req.user.id } } } },
      include: { payments: true },
    });

    if (!expense) {
      throw new ApiError("Expense not found", 404);
    }

    const payment = expense.payments.find((p) => p.id === paymentId);
    if (!payment) {
      throw new ApiError("Payment not found", 404);
    }

    await prisma.expensePayment.delete({ where: { id: paymentId } });

    const remainingPayments = await prisma.expensePayment.findMany({
      where: { expenseId },
      select: { amount: true },
    });
    const totalPaid = remainingPayments.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));
    const nextStatus =
      totalPaid.gte(expense.amount) && remainingPayments.length > 0
        ? ExpenseStatus.PAID
        : totalPaid.gt(0)
          ? ExpenseStatus.PARTIALLY_PAID
          : ExpenseStatus.PENDING;

    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: { status: nextStatus },
      include: { participants: true, lineItems: true, uploads: true, payments: true },
    });

    res.json({ expense: addParticipantCosts(updatedExpense) });
  } catch (error) {
    next(error);
  }
};

export const payExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = expenseParamsSchema.parse(req.params);
    const { amount, payerMemberId, notes, paidAt, receiptUrl } = payExpenseSchema.parse(req.body);

    const expense = await prisma.expense.findFirst({
      where: { id, group: { members: { some: { userId: req.user.id } } } },
      include: {
        group: { include: { members: true } },
        participants: true,
        payments: true,
      },
    });

    if (!expense) {
      throw new ApiError("Expense not found", 404);
    }

    const payerId = payerMemberId;
    const isInGroup = expense.group.members.some((member) => member.id === payerId);
    if (!isInGroup) {
      throw new ApiError("Payer is not part of this group", 400);
    }

    const totalPaid = expense.payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
    const outstanding = expense.amount.minus(totalPaid);
    const paymentAmount = new Prisma.Decimal(amount);

    if (paymentAmount.gt(outstanding)) {
      throw new ApiError("Payment exceeds outstanding balance", 400);
    }

    const newTotalPaid = totalPaid.plus(paymentAmount);
    const nextStatus = newTotalPaid.gte(expense.amount) ? ExpenseStatus.PAID : ExpenseStatus.PARTIALLY_PAID;

    const [payment] = await prisma.$transaction([
      prisma.expensePayment.create({
        data: {
          expenseId: id,
          payerId: payerId ?? undefined,
          amount: paymentAmount,
          currency: expense.currency,
          notes: notes ?? undefined,
          paidAt: paidAt ?? undefined,
          receiptUrl,
        },
      }),
      prisma.expense.update({
        where: { id },
        data: { status: nextStatus },
      }),
    ]);

    const updatedExpense = await prisma.expense.findUnique({
      where: { id },
      include: { participants: true, lineItems: true, uploads: true, payments: true },
    });

    res.status(201).json({
      expense: addParticipantCosts(updatedExpense!),
      payment,
      outstanding: outstanding.minus(paymentAmount).toFixed(2),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request", 400, error.flatten()));
      return;
    }
    next(error);
  }
};

export const updateExpensePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id: expenseId, paymentId } = req.params;
    const { amount, payerMemberId, notes, paidAt, receiptUrl } = payExpenseSchema.parse(req.body);

    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, group: { members: { some: { userId: req.user.id } } } },
      include: {
        group: { include: { members: true } },
        payments: true,
        participants: true,
      },
    });

    if (!expense) {
      throw new ApiError("Expense not found", 404);
    }

    const existingPayment = expense.payments.find((p) => p.id === paymentId);
    if (!existingPayment) {
      throw new ApiError("Payment not found", 404);
    }

    const isInGroup = expense.group.members.some((member) => member.id === payerMemberId);
    if (!isInGroup) {
      throw new ApiError("Payer is not part of this group", 400);
    }

    const otherPaymentsTotal = expense.payments
      .filter((p) => p.id !== paymentId)
      .reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));
    const paymentAmount = new Prisma.Decimal(amount);
    const newTotal = otherPaymentsTotal.plus(paymentAmount);

    if (newTotal.gt(expense.amount)) {
      throw new ApiError("Payment exceeds outstanding balance", 400);
    }

    const nextStatus =
      newTotal.gte(expense.amount) && newTotal.gt(0)
        ? ExpenseStatus.PAID
        : newTotal.gt(0)
          ? ExpenseStatus.PARTIALLY_PAID
          : ExpenseStatus.PENDING;

    await prisma.$transaction([
      prisma.expensePayment.update({
        where: { id: paymentId },
        data: {
          payerId: payerMemberId,
          amount: paymentAmount,
          currency: expense.currency,
          notes: notes ?? undefined,
          paidAt: paidAt ?? undefined,
          receiptUrl: receiptUrl ?? undefined,
        },
      }),
      prisma.expense.update({
        where: { id: expenseId },
        data: { status: nextStatus },
      }),
    ]);

    const updatedExpense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: { participants: true, lineItems: true, uploads: true, payments: true },
    });

    res.json({ expense: addParticipantCosts(updatedExpense!) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request", 400, error.flatten()));
      return;
    }
    next(error);
  }
};
