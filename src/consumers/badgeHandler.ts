import { randomUUID } from "crypto";
import prisma from "../../prisma/client";
import { BadgeUnlocked, EventMessage } from "../../types/event";
import { publish } from "../services/messageBroker";
import { EVENTS } from "../consts/events";
import { Prisma } from "../../generated/prisma/client";

export async function handleBadgeUnlocked(event: EventMessage) {
  const { userId } = event.payload;

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

    // Read back ids for the badges we just inserted so downstream can key the payout.
    const userBadges = await tx.userBadge.findMany({
      where: { userId, badgeId: { in: fresh.map(b => b.id) } },
      select: { id: true, badgeId: true },
    });

    const defById = new Map(
      fresh.map(b => [
        b.id,
        { name: b.name, cashback: Number(b.cashbackAmount) },
      ])
    );

    await recordProcessed(tx, event);

    return userBadges.map(u => {
      const def = defById.get(u.badgeId);
      return {
        userBadgeId: Number(u.id),
        userId,
        badgeName: def?.name ?? "",
        cashbackAmount: def?.cashback ?? 0,
      };
    });
  });

  for (const badge of awarded) {
    publish({
      eventId: randomUUID(),
      type: EVENTS.BADGE_UNLOCKED,
      occurredAt: new Date().toISOString(),
      payload: badge as BadgeUnlocked,
    });
    console.log(`${userId.toUpperCase()} earned badge ${badge.badgeName}`);
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
