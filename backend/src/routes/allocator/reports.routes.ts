import { Router } from "express";
import * as reportsController from "../../controllers/reports.controller";

const router = Router();
router.get("/investor-allocation", reportsController.investorAllocation);
router.get("/investor-statements", reportsController.investorStatements);
router.get("/investor-register", reportsController.investorRegister);
router.get("/unsent", reportsController.unsent);
router.get("/all", reportsController.all);
router.get("/preview/:investorId", reportsController.preview);
router.post("/send/:investorId", reportsController.sendOne);
router.post("/send-all", reportsController.sendAll);
export default router;
