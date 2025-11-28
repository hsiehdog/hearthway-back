import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import {
  completeUpload,
  deleteUpload,
  requestUploadUrl,
} from "../controllers/uploadedExpenseController";

const router = Router({ mergeParams: true });

router.post("/groups/:groupId/expense-uploads/presign", requireAuth, requestUploadUrl);
router.post("/uploads/:uploadId/complete", requireAuth, completeUpload);
router.delete("/uploads/:uploadId", requireAuth, deleteUpload);

export default router;
