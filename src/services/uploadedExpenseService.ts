import path from "node:path";
import { randomUUID } from "node:crypto";
import { Prisma, UploadParsingStatus, ExpenseStatus, UploadProcessingStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { storageConfig, deleteFromS3, generateSignedGetUrl, generateSignedPutUrl } from "../lib/storage";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import { uploadedExpenseQueue } from "../queues/uploadedExpenseQueue";

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
  throw new ApiError("Direct uploads are disabled", 400);
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

export async function createPresignedUpload({
  userId,
  groupId,
  fileName,
  contentType,
}: {
  userId: string;
  groupId: string;
  fileName: string;
  contentType: string;
}) {
  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    throw new ApiError("Unsupported file type", 415);
  }

  const membership = await ensureGroupMembership(userId, groupId);

  const expense = await prisma.expense.create({
    data: {
      groupId,
      status: ExpenseStatus.PENDING,
      splitType: "EVEN",
      amount: new Prisma.Decimal(0),
      currency: "USD",
      date: new Date(),
      name: fileName || "Uploaded expense",
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

  const key = buildStorageKey(expense.groupId, expense.id, fileName);
  const uploadUrl = await generateSignedPutUrl({ key, contentType, expiresInSeconds: 300 });
  const fileUrl = `https://${storageConfig.bucket}.s3.${storageConfig.region}.amazonaws.com/${key}`;

  const record = await prisma.uploadedExpense.create({
    data: {
      expenseId: expense.id,
      uploadedById: membership.id,
      fileUrl,
      fileType: contentType,
      originalFileName: fileName,
      storageBucket: storageConfig.bucket,
      storageKey: key,
      parsingStatus: UploadParsingStatus.PENDING,
      processingStatus: UploadProcessingStatus.QUEUED,
      processingAttempts: 0,
      lastError: null,
      startedAt: null,
      completedAt: null,
    },
    select: uploadedExpenseSelect,
  });

  return { upload: record, expenseId: expense.id, uploadUrl };
}

export async function markUploadComplete({
  userId,
  uploadId,
}: {
  userId: string;
  uploadId: string;
}) {
  const upload = await prisma.uploadedExpense.findFirst({
    where: {
      id: uploadId,
      expense: { group: { members: { some: { userId } } } },
    },
    include: {
      uploadedBy: true,
    },
  });

  if (!upload) {
    throw new ApiError("Upload not found", 404);
  }

  if (upload.uploadedBy && upload.uploadedBy.userId !== userId) {
    throw new ApiError("You do not own this upload", 403);
  }

  await prisma.uploadedExpense.update({
    where: { id: uploadId },
    data: {
      parsingStatus: UploadParsingStatus.PENDING,
      errorMessage: null,
      processingStatus: UploadProcessingStatus.QUEUED,
      lastError: null,
    },
  });

  await uploadedExpenseQueue.add("process-uploaded-expense", { uploadId }, { removeOnComplete: true, attempts: 3 });

  return upload;
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
