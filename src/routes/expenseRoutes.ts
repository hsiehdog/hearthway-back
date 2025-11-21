import { Router } from "express";
import { createExpense, updateExpense, deleteExpense } from "../controllers/expenseController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.post("/", requireAuth, createExpense);
router.put("/:id", requireAuth, updateExpense);
router.delete("/:id", requireAuth, deleteExpense);

export default router;
