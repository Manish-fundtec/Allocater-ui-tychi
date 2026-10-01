import { Router } from "express";
import * as tychiController from "../../controllers/tychi.controller";

const router = Router();
router.post("/fetch-pl", tychiController.fetchPl);
router.get("/import-history", tychiController.importHistory);
router.get("/test-connection", tychiController.testConnection);
export default router;
