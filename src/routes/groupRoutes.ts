import { Router } from "express";
import { createGroup, getGroup } from "../controllers/groupController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.post("/", requireAuth, createGroup);
router.get("/:id", requireAuth, getGroup);

export default router;
