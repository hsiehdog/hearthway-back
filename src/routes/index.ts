import { Router } from "express";
import aiRoutes from "./aiRoutes";
import userRoutes from "./userRoutes";
import healthRoutes from "./healthRoutes";
import groupRoutes from "./groupRoutes";
import expenseRoutes from "./expenseRoutes";
import uploadedExpenseRoutes from "./uploadedExpenseRoutes";

const router = Router();

router.use("/ai", aiRoutes);
router.use("/users", userRoutes);
router.use("/groups", groupRoutes);
router.use("/expenses", expenseRoutes);
router.use(uploadedExpenseRoutes);
router.use(healthRoutes);

export default router;
