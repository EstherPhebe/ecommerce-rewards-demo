import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import ErrorWithCode from "../utils/ErrorWithCode";
export function verifyPaystackSignature(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const webhookData = req.body;

    if (!secret) {
      throw new ErrorWithCode("Webhook unauthorized", 500);
    }

    const webhookSignature = req.header("x-paystack-signature");

    if (!webhookSignature || !webhookData) {
      throw new ErrorWithCode("Missing webhook signature", 401);
    }

    const generatedHash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(webhookData))
      .digest("hex");

    if (webhookSignature !== generatedHash) {
      console.error("Invalid webhook signature");
      throw new ErrorWithCode("Invalid webhook signature", 401);
    }

    next();
  } catch (error) {
    next(error);
  }
}
