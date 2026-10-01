import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import fundsRoutes from "./funds.routes";
import badgesRoutes from "./allocator/badges.routes";
import dashboardRoutes from "./allocator/dashboard.routes";
import allocationRoutes from "./allocator/allocation.routes";
import investorsRoutes from "./allocator/investors.routes";
import navRoutes from "./allocator/nav.routes";
import plReportsRoutes from "./allocator/pl-reports.routes";
import feesRoutes from "./allocator/fees.routes";
import tychiRoutes from "./allocator/tychi.routes";
import reportsRoutes from "./allocator/reports.routes";
import settingsRoutes from "./allocator/settings.routes";

const router = Router();

router.use(requireAuth);

router.use("/funds", fundsRoutes);
router.use("/allocator/badges", badgesRoutes);
router.use("/allocator", dashboardRoutes);
router.use("/allocator/allocation", allocationRoutes);
router.use("/allocator/investors", investorsRoutes);
router.use("/allocator/nav", navRoutes);
router.use("/allocator/pl-reports", plReportsRoutes);
router.use("/allocator/fees", feesRoutes);
router.use("/allocator/tychi", tychiRoutes);
router.use("/allocator/reports", reportsRoutes);
router.use("/allocator/settings", settingsRoutes);

export default router;
