import { Router } from "express";
import * as dashboardController from "../../controllers/dashboard.controller";

const router = Router();
router.get("/dashboard-stats", dashboardController.getStats);
export default router;
