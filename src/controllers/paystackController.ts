import { Request, Response } from "express";
import { z } from "zod";
import catchAsync from "../utils/catchAsync";
import ErrorWithCode from "../utils/ErrorWithCode";
import { payoutStatusFor, reasonFor } from "../services/payoutStatus";
import prisma from "../../prisma/client";
import { PayoutStatus } from "../../generated/prisma/enums";
import {
  finalizeTransfer,
  initializeTransaction,
} from "../services/paymentGateway";

const envelope = z.object({
  event: z.string(),
  data: z.record(z.string(), z.any()),
});

const STATUS_BY_EVENT: Record<string, PayoutStatus> = {
  "transfer.success": PayoutStatus.PAID,
  "transfer.failed": PayoutStatus.FAILED,
  "transfer.reversed": PayoutStatus.FAILED,
};

// POST /webhooks/paystack
export const handlePaystackWebhook = catchAsync(
  async (req: Request, res: Response) => {
    const { event, data } = envelope.parse(req.body);

    if (STATUS_BY_EVENT[event] === PayoutStatus.PAID) {
      await prisma.cashbackPayout.update({
        where: {
          payoutKey: data.reference,
        },
        data: {
          status: PayoutStatus.PAID,
          statusReason: null, // a settled payout has nothing left to explain
        },
      });

      console.log(`Payout done for ${data.recipient.name}`);
      res.status(200).json({ received: true });
      return;
    }

    res.status(200).json({ received: true });
  }
);

export const finalizePayout = catchAsync(
  async (req: Request, res: Response) => {
    const { otp, reference } = z
      .object({
        otp: z.string().min(6),
        reference: z.string(),
      })
      .parse(req.body);

    const payout = await prisma.cashbackPayout.findUnique({
      where: { payoutKey: reference },
      select: { id: true, status: true, transferCode: true, payoutKey: true },
    });

    if (!payout || !payout.transferCode) {
      // Previously returned without responding, leaving the request hanging.
      throw new ErrorWithCode(
        `No payout awaiting finalization for reference ${reference}`,
        404
      );
    }

    const result = await finalizeTransfer(otp, payout.transferCode);

    const status = payoutStatusFor(result.status);

    await prisma.cashbackPayout.update({
      where: { id: payout.id },
      data: {
        status,
        transferCode: result.transfer_code,
        statusReason: reasonFor(status),
      },
    });

    console.log(`Payout ${payout.id} finalized/ ${result.status} (${status})`);

    res.status(200).json({ success: true, data: { status, result } });
  }
);

export const transfer = catchAsync(async (req: Request, res: Response) => {
  const initialize = await initializeTransaction();

  res.status(200).json({ initialize });
});
