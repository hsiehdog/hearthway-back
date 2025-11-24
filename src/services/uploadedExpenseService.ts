import path from "node:path";
import { randomUUID } from "node:crypto";
import { Prisma, UploadParsingStatus, ExpenseStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { uploadToS3, storageConfig, deleteFromS3, generateSignedGetUrl } from "../lib/storage";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { parseUploadedExpense } from "./uploadedExpenseParserService";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const normalizeFileName = (originalName: string): string => {
  const ext = path.extname(originalName) || "";
  const base = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${base || "upload"}${ext}`;
};

const buildStorageKey = (groupId: string, expenseId: string, originalName: string): string => {
  const sanitizedName = normalizeFileName(originalName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `expenses/${groupId}/${expenseId}/${timestamp}-${randomUUID()}-${sanitizedName}`;
};

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const uploadedExpenseSelect = {
  id: true,
  expenseId: true,
  uploadedById: true,
  fileUrl: true,
  fileType: true,
  originalFileName: true,
  storageBucket: true,
  storageKey: true,
  parsingStatus: true,
  rawText: true,
  parsedJson: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UploadedExpenseSelect;

export async function ensureExpenseMembership(userId: string, expenseId: string) {
  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      group: {
        members: {
          some: {
            userId,
          },
        },
      },
    },
    select: {
      id: true,
      groupId: true,
    },
  });

  if (!expense) {
    throw new ApiError("Expense not found or not accessible", 404);
  }

  return expense;
}

export async function ensureGroupMembership(userId: string, groupId: string) {
  const membership = await prisma.groupMember.findFirst({
    where: {
      groupId,
      userId,
    },
    select: { id: true, groupId: true },
  });

  if (!membership) {
    throw new ApiError("Group not found or not accessible", 404);
  }

  return membership;
}

export async function uploadExpenseAndCreate({
  userId,
  groupId,
  file,
}: {
  userId: string;
  groupId: string;
  file: UploadedFile;
}) {
  if (!file) {
    throw new ApiError("File is required", 400);
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new ApiError("Unsupported file type", 415);
  }

  const membership = await ensureGroupMembership(userId, groupId);

  const expense = await prisma.expense.create({
    data: {
      groupId,
      payerId: membership.id,
      status: ExpenseStatus.PENDING,
      splitType: "EVEN",
      amount: new Prisma.Decimal(0),
      currency: "USD",
      date: new Date(),
      name: file.originalname || "Uploaded expense",
      description: "Pending receipt parsing",
      participants: {
        create: await prisma.groupMember
          .findMany({
            where: { groupId },
            select: { id: true },
          })
          .then((members) => members.map((member) => ({ memberId: member.id }))),
      },
    },
    select: { id: true, groupId: true },
  });

  const key = buildStorageKey(expense.groupId, expense.id, file.originalname);
  const uploaded = await uploadToS3({
    key,
    contentType: file.mimetype,
    body: file.buffer,
  });

  const record = await prisma.uploadedExpense.create({
    data: {
      expenseId: expense.id,
      uploadedById: membership.id,
      fileUrl: uploaded.url,
      fileType: file.mimetype,
      originalFileName: file.originalname,
      storageBucket: storageConfig.bucket,
      storageKey: uploaded.key,
      parsingStatus: UploadParsingStatus.PENDING,
    },
    select: uploadedExpenseSelect,
  });

  parseUploadedExpense(record.id).catch((error) => {
    logger.error("Failed to kick off upload parsing", { error, uploadId: record.id });
  });

  return { upload: record, expenseId: expense.id };
}

export async function getUploadedExpense(userId: string, uploadId: string) {
  const upload = await prisma.uploadedExpense.findFirst({
    where: {
      id: uploadId,
      expense: {
        group: {
          members: { some: { userId } },
        },
      },
    },
    select: uploadedExpenseSelect,
  });

  if (!upload) {
    throw new ApiError("Upload not found", 404);
  }

  return upload;
}

export async function generateUploadSignedUrl(userId: string, uploadId: string) {
  const upload = await getUploadedExpense(userId, uploadId);
  const expiresIn = 300;
  const url = await generateSignedGetUrl(upload.storageKey, expiresIn);
  return { url, expiresIn };
}

export async function deleteUploadedExpense(userId: string, uploadId: string) {
  const upload = await getUploadedExpense(userId, uploadId);

  try {
    await deleteFromS3(upload.storageKey);
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name !== "NoSuchKey") {
      logger.error("Failed to delete upload from S3", {
        error,
        uploadId,
        key: upload.storageKey,
      });
      throw new ApiError("Unable to delete file right now", 502);
    }
    logger.warn("S3 object missing during delete", {
      uploadId,
      key: upload.storageKey,
    });
  }

  await prisma.uploadedExpense.delete({
    where: { id: uploadId },
  });
}
