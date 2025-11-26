import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { deleteUploadedExpense, uploadExpenseAndCreate } from "../services/uploadedExpenseService";
import { ApiError } from "../middleware/errorHandler";

const groupParamSchema = z.object({
  groupId: z.string().min(1),
});

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const uploadIdParamSchema = z.object({
  uploadId: z.string().min(1),
});

type UploadedFiles = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}[];

export const createUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new ApiError("Unauthorized", 401);
    const { groupId } = groupParamSchema.parse(req.params);

    const file = (req as Request & { file?: UploadedFile }).file;
    if (!file) {
      throw new ApiError("File is required", 400);
    }

    const { upload, expenseId } = await uploadExpenseAndCreate({
      userId: req.user.id,
      groupId,
      file,
    });

    res.status(201).json({ upload, expenseId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request", 400, error.flatten()));
      return;
    }
    next(error);
  }
};

export const createUploads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw new ApiError("Unauthorized", 401);
    const { groupId } = groupParamSchema.parse(req.params);

    const files = (req as Request & { files?: UploadedFiles }).files;
    if (!files || files.length === 0) {
      throw new ApiError("At least one file is required", 400);
    }

    const results = await Promise.all(
      files.map((file) =>
        uploadExpenseAndCreate({
          userId: req.user!.id,
          groupId,
          file,
        }),
      ),
    );

    res.status(201).json({
      uploads: results.map((result) => result.upload),
      expenseIds: results.map((result) => result.expenseId),
    });
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
