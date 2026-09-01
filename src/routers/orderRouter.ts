import express from "express";
import {
  completeOrder,
  setAccountDetails,
} from "../controllers/orderController";

const orderRouter = express.Router();

orderRouter.route("/orders/complete").post(completeOrder);

// Payout details are captured here.
orderRouter.route("/users/:userId/account-details").put(setAccountDetails);

export default orderRouter;
