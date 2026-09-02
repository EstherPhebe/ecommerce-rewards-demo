import prisma from "../../prisma/client";
import crypto from "crypto";
import { BadgeUnlocked, EventMessage } from "../../types/event";
import {
  PayoutStatus,
  PayoutRecipientType,
} from "../../generated/prisma/enums";
import { payoutStatusFor, reasonFor } from "../services/payoutStatus";
import {
  createTransferRecipient,
  initiateTransfer,
} from "../services/paymentGateway";

export async function handleBadgeUnlocked(
  event: EventMessage<BadgeUnlocked>
): Promise<void> {
  const { badge_name, user } = event.payload;
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
          status: PayoutStatus.CREATED,
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

  if (
    payout.status === PayoutStatus.PROCESSING ||
    payout.status === PayoutStatus.AWAITING_OTP ||
    payout.status === PayoutStatus.PAID
  ) {
    console.log(`Payout ${payout.id} already ${payout.status}`);
    return;
  }

  try {
    const recipientCode = await ensureRecipientCode(userId);

    if (!recipientCode) {
      await prisma.cashbackPayout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.AWAITING_PAYOUT_METHOD,
          statusReason: "no payout method on file",
        },
      });

      console.warn(`No payout method on file for ${userId}`);
      return;
    }

    // Committed BEFORE the call, and deliberately not in a transaction.
    // Recovery reads INITIATED as "a transfer may exist, which it cannot infer from CREATED.
    await prisma.cashbackPayout.update({
      where: { id: payout.id },
      data: { status: PayoutStatus.INITIATED, statusReason: null },
    });

    const result = await initiateTransfer({
      reference: payout.payoutKey,
      recipientCode,
      amount: Math.round(cashbackAmount * 100),
      reason: `badge:${badge_name}`,
    });

    const status = payoutStatusFor(result.status);

    await prisma.cashbackPayout.update({
      where: { id: payout.id },
      data: {
        status,
        payoutKey: result.reference,
        transferCode: result.transfer_code,
        statusReason: reasonFor(status),
      },
    });

    console.log(
      `Transfer ${result.transfer_code} for ${userId}/ (payout ${status})`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown gateway error";

    await prisma.cashbackPayout.update({
      where: { id: payout.id },
      data: { statusReason: `unresolved: ${message}` },
    });

    // Re-throw so the broker retries.
    throw error;
  }
}

async function ensureRecipientCode(userId: string): Promise<string | null> {
  const existing = await prisma.payoutRecipient.findUnique({
    where: { userId },
    select: { recipientCode: true },
  });

  if (existing?.recipientCode) return existing.recipientCode;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, accountNumber: true, bankCode: true },
  });

  if (!user?.accountNumber || !user.bankCode) return null;

  // A gateway failure here throws, and the broker retries the whole handler
  const { recipientCode } = await createTransferRecipient({
    type: PayoutRecipientType.NUBAN,
    name: user.name ?? userId,
    accountNumber: user.accountNumber,
    bankCode: user.bankCode,
  });

  await prisma.payoutRecipient.upsert({
    where: { userId },
    create: { userId, recipientCode, active: true },
    update: { recipientCode, active: true },
  });

  return recipientCode;
}
