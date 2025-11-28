import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createPresignedUpload, deleteUploadedExpense, markUploadComplete } from "../services/uploadedExpenseService";
import { ApiError } from "../middleware/errorHandler";

const groupParamSchema = z.object({
  groupId: z.string().min(1),
});

const uploadIdParamSchema = z.object({
  uploadId: z.string().min(1),
});

const presignBodySchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
});

export const requestUploadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new ApiError("Unauthorized", 401);
    const { groupId } = groupParamSchema.parse(req.params);
    const { fileName, contentType } = presignBodySchema.parse(req.body);

    const { upload, expenseId, uploadUrl } = await createPresignedUpload({
      userId: req.user.id,
      groupId,
      fileName,
      contentType,
    });

    res.status(201).json({ upload, expenseId, uploadUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request", 400, error.flatten()));
      return;
    }
    next(error);
  }
};

export const completeUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new ApiError("Unauthorized", 401);
    const { uploadId } = uploadIdParamSchema.parse(req.params);
    const upload = await markUploadComplete({ userId: req.user.id, uploadId });
    res.status(200).json({ upload });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request", 400, error.flatten()));
      return;
    }
    next(error);
  }
};

export const deleteUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new ApiError("Unauthorized", 401);
    const { uploadId } = uploadIdParamSchema.parse(req.params);
    await deleteUploadedExpense(req.user.id, uploadId);
    res.status(204).end();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request", 400, error.flatten()));
      return;
    }
    next(error);
  }
};
