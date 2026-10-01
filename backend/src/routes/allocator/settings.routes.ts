import { Router } from "express";
import * as settingsController from "../../controllers/settings.controller";

const router = Router();
router.get("/", settingsController.get);
router.post("/", settingsController.post);
router.put("/", settingsController.put);
export default router;
