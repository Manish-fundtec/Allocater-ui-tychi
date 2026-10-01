import { Router } from "express";
import * as investorsController from "../../controllers/investors.controller";

const router = Router();
router.get("/", investorsController.list);
router.get("/:id", investorsController.getById);
router.patch("/:id", investorsController.patch);
export default router;
