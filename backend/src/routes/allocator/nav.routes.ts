import { Router } from "express";
import * as navController from "../../controllers/nav.controller";

const router = Router();
router.get("/history", navController.history);
router.get("/all", navController.all);
router.get("/seed-preview", navController.seedPreview);
router.post("/seed", navController.seed);
router.post("/carry-forward", navController.carryForward);
router.post("/open-period", navController.openPeriod);
router.get("/config", navController.config);
router.patch("/config", navController.updateConfig);
export default router;
