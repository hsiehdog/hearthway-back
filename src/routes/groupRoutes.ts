import { Router } from "express";
import { addGroupMember, createGroup, getGroup, listGroups } from "../controllers/groupController";
import { createFlightItineraryItem, getMemberTransport } from "../controllers/transportController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/", requireAuth, listGroups);
router.post("/", requireAuth, createGroup);
router.get("/:id", requireAuth, getGroup);
router.post("/:id/members", requireAuth, addGroupMember);
router.post("/:groupId/transport/flights", requireAuth, createFlightItineraryItem);
router.get("/:groupId/members/:memberId/transport", requireAuth, getMemberTransport);

export default router;
