import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import catchAsync from "../utils/catchAsync";
import { EVENTS } from "../consts/events";
import { EventMessage, OrderCompleted } from "../../types/event";
import { publish } from "../services/messageBroker";
import prisma from "../../prisma/client";

const orderCompletedSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().optional(),
  amount: z.number(),
  settled: z.boolean().default(true), // a confirmed order is settled by default
});

// POST /orders/complete
export const completeOrder = catchAsync(async (req: Request, res: Response) => {
  const { orderId, userId, amount, settled, name } = orderCompletedSchema.parse(
    req.body
  );

  const event: EventMessage = {
    eventId: randomUUID(),
    type: EVENTS.ORDER_COMPLETED,
    occurredAt: new Date().toISOString(),
    payload: {
      orderId,
      userId,
      name,
      amount,
      settled,
    } as OrderCompleted,
  };

  publish(event);

  res.status(202).json({
    success: true,
    message: "order.completed emitted",
    data: { eventId: event.eventId },
  });
});

const accountDetailsSchema = z.object({
  name: z.string().min(1).optional(),
  // NUBAN account numbers are exactly 10 digits; bank codes are 3.
  accountNumber: z
    .string()
    .regex(/^\d{10}$/, "accountNumber must be 10 digits"),
  bankCode: z.string().regex(/^\d{3}$/, "bankCode must be 3 digits"),
});

// PUT /users/:userId/account-details
export const setAccountDetails = catchAsync(
  async (req: Request, res: Response) => {
    const { userId } = z
      .object({ userId: z.string().min(1) })
      .parse(req.params);

    const { accountNumber, bankCode, name } = accountDetailsSchema.parse(
      req.body
    );

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { accountNumber: true, bankCode: true },
    });

    const user = await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, name, accountNumber, bankCode },
      update: { accountNumber, bankCode, ...(name ? { name } : {}) },
      select: { id: true, name: true, accountNumber: true, bankCode: true },
    });

    // The Paystack recipient_code is derived from the account, so a changed
    // account invalidates it
    const changed =
      existing !== null &&
      (existing.accountNumber !== accountNumber ||
        existing.bankCode !== bankCode);

    if (changed) {
      await prisma.payoutRecipient.updateMany({
        where: { userId },
        data: { recipientCode: null },
      });
      console.log(
        `Payout account changed for ${userId}, previous recipient code cleared`
      );
    }

    res.status(200).json({
      success: true,
      message: changed
        ? "account details updated; payout recipient will be recreated"
        : "account details saved",
      data: {
        userId: user.id,
        accountNumber: user.accountNumber,
        bankCode: user.bankCode,
      },
    });
  }
);
