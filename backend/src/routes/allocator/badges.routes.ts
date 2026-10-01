import { Router } from "express";
import * as badgesController from "../../controllers/badges.controller";

const router = Router();
router.get("/", badgesController.getBadges);
export default router;
