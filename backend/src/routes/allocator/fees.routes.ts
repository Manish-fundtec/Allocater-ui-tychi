import { Router } from "express";
import * as feesController from "../../controllers/fees.controller";

const router = Router();
router.get("/", feesController.get);
router.post("/", feesController.post);
router.post("/review", feesController.review);
export default router;
