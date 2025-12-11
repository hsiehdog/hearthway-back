import { Router } from "express";
import { listAirlines } from "../controllers/referenceController";

const router = Router();

router.get("/airlines", listAirlines);

export default router;
