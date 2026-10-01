import { Router } from "express";
import * as allocationController from "../../controllers/allocation.controller";

const router = Router();
router.get("/history", allocationController.getHistory);
router.get("/investor-history", allocationController.getInvestorHistory);
router.post("/preview", allocationController.preview);
router.post("/run", allocationController.run);
export default router;
