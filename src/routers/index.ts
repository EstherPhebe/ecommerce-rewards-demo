import express from "express";
import orderRouter from "./orderRouter";

const router = express.Router();

router.use("/", orderRouter); // (emits order.completed)

export default router;
