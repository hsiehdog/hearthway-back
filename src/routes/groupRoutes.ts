import { Router } from "express";
import { addGroupMember, createGroup, getGroup, listGroups } from "../controllers/groupController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/", requireAuth, listGroups);
router.post("/", requireAuth, createGroup);
router.get("/:id", requireAuth, getGroup);
router.post("/:id/members", requireAuth, addGroupMember);

export default router;
