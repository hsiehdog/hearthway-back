import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/errorHandler";
import { SUPPORTED_SECTIONS, TripIntelSection, tripIntelService } from "../services/tripIntelService";

const tripIntelParamsSchema = z.object({
  tripId: z.string().min(1, "tripId is required"),
});

const tripIntelQuerySchema = z.object({
  sections: z.string().optional(),
});

export const getTripIntel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { tripId } = tripIntelParamsSchema.parse(req.params);
    const { sections } = tripIntelQuerySchema.parse(req.query);

    const requestedSections = sections
      ? sections
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const invalidSections = requestedSections.filter(
      (section) => !SUPPORTED_SECTIONS.includes(section as TripIntelSection),
    );

    if (invalidSections.length) {
      throw new ApiError("Invalid sections requested", 400, { invalidSections, supported: SUPPORTED_SECTIONS });
    }

    const intel = await tripIntelService.getTripSnapshot({
      tripId,
      userId: req.user.id,
      sections: requestedSections as TripIntelSection[],
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
