import { Router } from "express";
import { createExpense } from "../controllers/expenseController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.post("/", requireAuth, createExpense);

export default router;
