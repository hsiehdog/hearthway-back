import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/authMiddleware";
import { createUpload, deleteUpload } from "../controllers/uploadedExpenseController";

const maxFileSize = Number(process.env.FILE_UPLOAD_MAX_BYTES ?? 10 * 1024 * 1024);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxFileSize } });

const router = Router({ mergeParams: true });

router.post("/groups/:groupId/expense-uploads", requireAuth, upload.single("file"), createUpload);
router.delete("/uploads/:uploadId", requireAuth, deleteUpload);

export default router;
