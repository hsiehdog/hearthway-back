// src/controllers/httpHandler.ts
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/errorHandler";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export function httpHandler(fn: AsyncHandler): AsyncHandler {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new ApiError("Invalid request", 400, z.treeifyError(err)));
      }
      next(err);
    }
  };
}
