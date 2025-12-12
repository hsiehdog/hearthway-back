import { Router } from "express";
import {
  addGroupMember,
  createGroup,
  getGroup,
  listGroups,
} from "../controllers/groupController";
import {
  createFlightItineraryItem,
  getMemberTransport,
  handleTransportChat,
  getTransportChatHistory,
} from "../controllers/transportController";
import { requireAuth } from "../middleware/authMiddleware";
import { requireGroupMember } from "../middleware/groupAuthMiddleware";

const router = Router();
router.use(requireAuth);

router.get("/", listGroups);
router.post("/", createGroup);

router.use("/:groupId", requireGroupMember);

router.get("/:groupId", getGroup);
router.post("/:groupId/members", addGroupMember);
router.post("/:groupId/transport/flights", createFlightItineraryItem);
router.get("/:groupId/members/:memberId/transport", getMemberTransport);
router.post("/:groupId/transport/chat", handleTransportChat);
router.get("/:groupId/transport/chat", getTransportChatHistory);

export default router;
