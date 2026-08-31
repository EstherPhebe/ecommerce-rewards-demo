import express from "express";
import orderRouter from "./orderRouter";
import achievementRouter from "./achievementRouter";

const router = express.Router();

router.use("/", orderRouter); // (emits order.completed)
router.use("/", achievementRouter);

export default router;
