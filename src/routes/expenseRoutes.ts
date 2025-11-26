import { Router } from "express";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  getExpense,
  payExpense,
  deleteExpensePayment,
  updateExpensePayment,
} from "../controllers/expenseController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();

router.get("/:id", requireAuth, getExpense);
router.post("/", requireAuth, createExpense);
router.put("/:id", requireAuth, updateExpense);
router.post("/:id/payments", requireAuth, payExpense);
router.delete("/:id/payments/:paymentId", requireAuth, deleteExpensePayment);
router.put("/:id/payments/:paymentId", requireAuth, updateExpensePayment);
router.delete("/:id", requireAuth, deleteExpense);

export default router;
