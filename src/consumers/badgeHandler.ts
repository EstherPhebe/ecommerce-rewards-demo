import { randomUUID } from "crypto";
import prisma from "../../prisma/client";
import { BadgeUnlocked, EventMessage } from "../../types/event";
import { publish } from "../services/messageBroker";
import { EVENTS } from "../consts/events";
import { Prisma } from "../../generated/prisma/client";

export async function handleBadgeUnlocked(event: EventMessage) {
  const { user } = event.payload;
  const userId = user.id;

  const awarded = await prisma.$transaction(async tx => {
    // Serialize per-user (same reason as purchaseRegistrar): concurrent achievement.unlocked
    // events must each see all prior committed unlocks, or a badge tier gets missed.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const achievementsCount = await tx.userAchievement.count({
      where: { userId },
    });

    const eligibleBadges = await tx.badge.findMany({
      where: { achievementThreshold: { lte: achievementsCount } },
      select: { id: true, name: true, cashbackAmount: true },
    });

    const existingBadges = await tx.userBadge.findMany({
      where: { userId, badgeId: { in: eligibleBadges.map(b => b.id) } },
      select: { badgeId: true },
    });

    const alreadySet = new Set(existingBadges.map(b => b.badgeId));

    const fresh = eligibleBadges.filter(b => !alreadySet.has(b.id));
    if (fresh.length === 0) {
      await recordProcessed(tx, event);
      return [] as BadgeUnlocked[];
    }

    await tx.userBadge.createMany({
      data: fresh.map(b => ({ userId, badgeId: b.id })),
      skipDuplicates: true,
    });

    await recordProcessed(tx, event);

    return fresh.map(b => b.name);
  });

  for (const badge_name of awarded) {
    publish({
      eventId: randomUUID(),
      type: EVENTS.BADGE_UNLOCKED,
      occurredAt: new Date().toISOString(),
      payload: { badge_name, user } as BadgeUnlocked,
    });
    console.log(`${userId.toUpperCase()} earned badge ${badge_name}`);
  }
}

async function recordProcessed(
  tx: Prisma.TransactionClient,
  event: EventMessage
) {
  await tx.processedEvent.createMany({
    data: [{ eventId: event.eventId, eventType: event.type }],
    skipDuplicates: true,
  });
}
