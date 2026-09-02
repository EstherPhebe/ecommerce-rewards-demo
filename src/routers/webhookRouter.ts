import express from "express";
import { verifyPaystackSignature } from "../middleware/verifyPaystackSignature";
import {
  finalizePayout,
  handlePaystackWebhook,
} from "../controllers/paystackController";

const webhookRouter = express.Router();

webhookRouter
  .route("/webhooks/paystack")
  .post(verifyPaystackSignature, handlePaystackWebhook);

webhookRouter.post("/finalize-transfer", finalizePayout);

export default webhookRouter;
