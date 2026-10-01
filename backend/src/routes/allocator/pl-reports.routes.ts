import { Router } from "express";
import * as plReportsController from "../../controllers/plReports.controller";

const router = Router();
router.get("/", plReportsController.list);
export default router;
