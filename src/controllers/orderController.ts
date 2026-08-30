import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import catchAsync from "../utils/catchAsync";
import { EVENTS } from "../consts/events";
import { EventMessage, OrderCompleted } from "../../types/event";
import { publish } from "../services/messageBroker";

const orderCompletedSchema = z.object({
  email: z.email(),
  orderId: z.string().min(1),
  userId: z.string().min(1),
  amount: z.number(),
  settled: z.boolean().default(true), // a confirmed order is settled by default
});

// POST /orders/complete
export const completeOrder = catchAsync(async (req: Request, res: Response) => {
  const { orderId, userId, amount, settled } = orderCompletedSchema.parse(
    req.body
  );

  const event: EventMessage = {
    eventId: randomUUID(),
    type: EVENTS.ORDER_COMPLETED,
    occurredAt: new Date().toISOString(),
    payload: { orderId, userId, amount, settled } as OrderCompleted,
  };

  console.log("event", event);

  publish(event);

  res.status(202).json({
    success: true,
    message: "order.completed emitted",
    data: { eventId: event.eventId },
  });
});
