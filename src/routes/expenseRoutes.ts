import { Router } from "express";
import { createExpense, updateExpense, deleteExpense, getExpense, payExpense } from "../controllers/expenseController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/:id", requireAuth, getExpense);
router.post("/", requireAuth, createExpense);
router.put("/:id", requireAuth, updateExpense);
router.post("/:id/payments", requireAuth, payExpense);
router.delete("/:id", requireAuth, deleteExpense);

export default router;
