import { Router } from "express";
import { getTripIntel } from "../controllers/tripIntelController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/:tripId/intel", requireAuth, getTripIntel);

export default router;
