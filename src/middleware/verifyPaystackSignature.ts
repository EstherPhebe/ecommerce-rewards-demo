import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import env from "../config/env";
import ErrorWithCode from "../utils/ErrorWithCode";

export function verifyPaystackSignature(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const secret = env.PAYSTACK_SECRET_KEY;

    if (!secret) {
      throw new ErrorWithCode("Unauthorized", 500);
    }

    const webhookSignature = req.header("x-paystack-signature");
    const webhookRaw = req.rawBody;

    if (!webhookSignature || !webhookRaw) {
      throw new ErrorWithCode("Missing signature", 401);
    }

    const generatedHash = crypto
      .createHmac("sha512", secret)
      .update(webhookRaw)
      .digest("hex");

    if (webhookSignature !== generatedHash) {
      console.error("Invalid signature");
      throw new ErrorWithCode("Invalid signature", 401);
    }

    next();
  } catch (error) {
    next(error);
  }
}
