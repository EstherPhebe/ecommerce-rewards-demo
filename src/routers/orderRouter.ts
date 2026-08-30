import express from "express";
import { completeOrder } from "../controllers/orderController";

const orderRouter = express.Router();

orderRouter.route("/orders/complete").post(completeOrder);

export default orderRouter;
