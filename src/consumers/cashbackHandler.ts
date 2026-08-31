import prisma from "../../prisma/client";
import crypto from "crypto";
import { BadgeUnlocked, EventMessage } from "../../types/event";
import { PayoutStatus } from "../../generated/prisma/enums";
import { initiateTransfer } from "../services/paymentGateway";

export async function handleBadgeUnlocked(event: EventMessage): Promise<void> {
  const { badge_name, user } = event.payload as BadgeUnlocked;
  const userId = user.id;

  const badge = await prisma.badge.findUnique({
    where: { name: badge_name },
    select: { id: true, cashbackAmount: true },
  });

  if (!badge) {
    console.warn(`Unknown badge ${badge_name}`);
    return;
  }

  const userBadge = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
    select: { id: true },
  });

  if (!userBadge) {
    console.warn(`No user_badge for ${userId}/${badge_name}`);
    return;
  }

  const cashbackAmount = Number(badge.cashbackAmount);
  const payoutRef = `REF-${userBadge.id}-${Date.now()}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  // Ensure the payout row exists (idempotent), then read its current status.
  const payout = await prisma.$transaction(async tx => {
    await tx.cashbackPayout.createMany({
      data: [
        {
          userBadgeId: userBadge.id,
          userId,
          amount: cashbackAmount,
          payoutKey: payoutRef,
          status: PayoutStatus.INITIATED,
        },
      ],
      skipDuplicates: true,
    });

    return tx.cashbackPayout.findUnique({
      where: { userBadgeId: userBadge.id },
      select: { id: true, payoutKey: true, status: true },
    });
  });

  if (!payout) return; // shouldn't happen; the row was just ensured

  // Already initiated, nothing to do.
  if (
    payout.status === PayoutStatus.PENDING ||
    payout.status === PayoutStatus.PAID
  ) {
    console.log(`Payout ${payout.id} already ${payout.status}`);
    return;
  }

  const recipient = await prisma.payoutRecipient.findUnique({
    where: { userId },
    select: { id: true, recipientCode: true },
  });

  if (!recipient || recipient.recipientCode === null) {
    //should this be called again, come back to this
    return;
  }

  try {
    const result = await initiateTransfer({
      reference: payout.payoutKey,
      recipientCode: recipient.recipientCode,
      amount: cashbackAmount * 1000,
      reason: `badge:${badge_name}`,
    });

    await prisma.cashbackPayout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.PROCESSING,
        payoutKey: result.reference,
        transferCode: result.transfer_code,
      },
    });

    console.log(`Transfer initiated for ${userId}`);
  } catch (error) {
    await prisma.cashbackPayout.update({
      where: { id: payout.id },
      data: { status: PayoutStatus.FAILED },
    });
    // Re-throw so the broker retries.
    throw error;
  }
}
