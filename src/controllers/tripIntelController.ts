import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/errorHandler";
import { tripIntelService } from "../services/tripIntelService";

const tripIntelParamsSchema = z.object({
  tripId: z.string().min(1, "tripId is required"),
});

export const getTripIntel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { tripId } = tripIntelParamsSchema.parse(req.params);

    const intel = await tripIntelService.getTripSnapshot({
      tripId,
      userId: req.user.id,
    });

    res.json(intel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError("Invalid request parameters", 400, error.flatten()));
      return;
    }

    next(error);
  }
};
