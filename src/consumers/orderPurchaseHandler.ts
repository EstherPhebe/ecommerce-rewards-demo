import { randomUUID } from "crypto";
import {
  AchievementUnlocked,
  EventMessage,
  EventUser,
  OrderCompleted,
} from "../../types/event";
import prisma from "../../prisma/client";
import { EVENTS } from "../consts/events";
import { publish } from "../services/messageBroker";
import env from "../config/env";

const PURCHASE_GROUP = "order_count";

export async function handleOrderCompleted(
  event: EventMessage<OrderCompleted>
) {
  const { orderId, userId, amount, name } = event.payload;

  //check to limit
  if (amount < env.MIN_ORDER_AMOUNT) {
    console.log(`Order ${orderId} below floor (${amount})`);
    return;
  }

  const newOrderCompleted = await prisma.$transaction(async tx => {
    await tx.user.createMany({
      data: [{ id: userId, name }],
      skipDuplicates: true,
    });

    // Serialize per-user processing on the user row.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const inserted = await tx.purchase.createMany({
      data: [{ orderId, userId, amount }],
      skipDuplicates: true,
    });

    if (inserted.count === 0) return []; // duplicate order complete event

    // Order_count recomputed every time
    const orderCount = await tx.purchase.count({ where: { userId } });

    // Achievements the user now qualifies for.
    const eligibleAchievements = await tx.achievement.findMany({
      where: { group: PURCHASE_GROUP, threshold: { lte: orderCount } },
      select: { id: true, name: true },
    });

    const existingAchievement = await tx.userAchievement.findMany({
      where: {
        userId,
        achievementId: { in: eligibleAchievements.map(e => e.id) },
      },
      select: { achievementId: true },
    });

    const alreadySet = new Set(existingAchievement.map(e => e.achievementId));

    const fresh = eligibleAchievements.filter(e => !alreadySet.has(e.id));

    if (fresh.length > 0) {
      await tx.userAchievement.createMany({
        data: fresh.map(d => ({ userId, achievementId: d.id })),
        skipDuplicates: true,
      });
    }

    await tx.processedEvent.createMany({
      data: [{ eventId: event.eventId, eventType: event.type }],
      skipDuplicates: true,
    });

    return fresh;
  });

  if (newOrderCompleted.length === 0) return;

  const record = await prisma.user.findUnique({ where: { id: userId } });
  if (!record) return;

  const user: EventUser = {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt.toISOString(),
  };

  for (const { name } of newOrderCompleted) {
    publish({
      eventId: randomUUID(),
      type: EVENTS.ACHIEVEMENT_UNLOCKED,
      occurredAt: new Date().toISOString(),
      payload: { achievement_name: name, user } as AchievementUnlocked,
    });

    console.log(`${userId.toUpperCase()} unlocked achievement ${name}`);
  }
}
