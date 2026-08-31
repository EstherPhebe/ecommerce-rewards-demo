import express from "express";
import orderRouter from "./orderRouter";
import achievementRouter from "./achievementRouter";
import webhookRouter from "./webhookRouter";

const router = express.Router();

router.use("/", orderRouter); // (emits order.completed)
router.use("/", achievementRouter);
router.use("/", webhookRouter);

export default router;
