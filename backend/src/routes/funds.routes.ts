import { Router } from "express";
import * as fundsController from "../controllers/funds.controller";

const router = Router();
router.get("/", fundsController.listFunds);
export default router;
