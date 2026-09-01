import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { PayoutStatus } from "../../generated/prisma/enums";

// Both boundaries are replaced: no database, no HTTP.
jest.mock("../../prisma/client", () => ({
  __esModule: true,
  default: {
    badge: { findUnique: jest.fn() },
    userBadge: { findUnique: jest.fn() },
    payoutRecipient: { findUnique: jest.fn(), upsert: jest.fn() },
    user: { findUnique: jest.fn() },
    cashbackPayout: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("../services/paymentGateway", () => {
  const actual = jest.requireActual(
    "../services/paymentGateway"
  ) as typeof import("../services/paymentGateway");
  return {
    __esModule: true,

    PaystackError: actual.PaystackError,
    createTransferRecipient: jest.fn(),
    initiateTransfer: jest.fn(),
  };
});

import prismaClient from "../../prisma/client";
import * as gateway from "../services/paymentGateway";
import { handleBadgeUnlocked } from "../consumers/cashbackHandler";

// The return type must be a Promise or mockResolvedValue infers `never`.
type AnyMock = jest.Mock<(...args: never[]) => Promise<unknown>>;

const prisma = prismaClient as unknown as {
  badge: { findUnique: AnyMock };
  userBadge: { findUnique: AnyMock };
  payoutRecipient: { findUnique: AnyMock; upsert: AnyMock };
  user: { findUnique: AnyMock };
  cashbackPayout: { update: AnyMock };
  $transaction: AnyMock;
};

const createTransferRecipient =
  gateway.createTransferRecipient as unknown as AnyMock;
const initiateTransfer = gateway.initiateTransfer as unknown as AnyMock;

const event = {
  eventId: "evt-1",
  type: "badge.unlocked",
  occurredAt: new Date().toISOString(),
  payload: {
    badge_name: "bronze",
    user: { id: "user-1", name: "Ada", createdAt: "" },
  },
} as never;

/** Every update() call's `data`, in order, for asserting what was written. */
const updates = () =>
  prisma.cashbackPayout.update.mock.calls.map(
    (c: unknown[]) => (c[0] as { data: Record<string, unknown> }).data
  );

function givenPayout(status: PayoutStatus) {
  prisma.badge.findUnique.mockResolvedValue({ id: 1n, cashbackAmount: 300 });
  prisma.userBadge.findUnique.mockResolvedValue({ id: 7n });
  prisma.$transaction.mockResolvedValue({
    id: 42n,
    payoutKey: "REF-7-ABC",
    status,
  });
  prisma.cashbackPayout.update.mockResolvedValue({});
}

function givenRecipient(code: string | null) {
  prisma.payoutRecipient.findUnique.mockResolvedValue(
    code ? { recipientCode: code } : { recipientCode: null }
  );
  prisma.user.findUnique.mockResolvedValue({
    name: "Ada",
    accountNumber: "0123456789",
    bankCode: "058",
  });
}

const gatewayError = (httpStatus: number) =>
  new gateway.PaystackError({
    status: httpStatus,
    statusText: "",
    data: { status: false, message: "nope", code: "some_code" },
  } as never);

beforeEach(() => {
  jest.clearAllMocks();
  givenPayout(PayoutStatus.CREATED);
  givenRecipient("RCP_existing");
});

describe("gateway outcomes map onto payout status", () => {
  it("parks a transfer that needs an OTP", async () => {
    initiateTransfer.mockResolvedValue({
      reference: "REF-7-ABC",
      transfer_code: "TRF_9cx2eo1myydqhr7c",
      status: "otp",
    });

    await handleBadgeUnlocked(event);

    const last = updates().at(-1)!;
    expect(last.status).toBe(PayoutStatus.AWAITING_OTP);
    expect(last.transferCode).toBe("TRF_9cx2eo1myydqhr7c");
    expect(last.statusReason).toMatch(/otp/i);
  });

  it("marks an accepted transfer as processing", async () => {
    initiateTransfer.mockResolvedValue({
      reference: "REF-7-ABC",
      transfer_code: "TRF_1",
      status: "pending",
    });

    await handleBadgeUnlocked(event);

    const last = updates().at(-1)!;
    expect(last.status).toBe(PayoutStatus.PROCESSING);
    expect(last.statusReason).toBeNull();
  });

  it("settles a transfer that succeeded immediately", async () => {
    initiateTransfer.mockResolvedValue({
      reference: "REF-7-ABC",
      transfer_code: "TRF_1",
      status: "success",
    });

    await handleBadgeUnlocked(event);

    expect(updates().at(-1)!.status).toBe(PayoutStatus.PAID);
  });
});

describe("failure is only recorded when it is a fact", () => {
  it("marks FAILED when Paystack answered and refused", async () => {
    initiateTransfer.mockRejectedValue(gatewayError(400));

    await expect(handleBadgeUnlocked(event)).rejects.toThrow();

    expect(updates().at(-1)!.status).toBe(PayoutStatus.FAILED);
  });

  it("leaves the status alone when the gateway never answered", async () => {
    initiateTransfer.mockRejectedValue(new Error("connect ECONNREFUSED"));

    await expect(handleBadgeUnlocked(event)).rejects.toThrow();

    const last = updates().at(-1)!;
    expect(last.status).toBeUndefined();
    expect(last.statusReason).toMatch(/^unresolved:/);
  });

  it("leaves the status alone on a 5xx", async () => {
    initiateTransfer.mockRejectedValue(gatewayError(503));

    await expect(handleBadgeUnlocked(event)).rejects.toThrow();

    const last = updates().at(-1)!;
    expect(last.status).toBeUndefined();
    expect(last.statusReason).toMatch(/^unresolved:/);
  });

  it("re-throws so the broker retries", async () => {
    initiateTransfer.mockRejectedValue(new Error("boom"));

    await expect(handleBadgeUnlocked(event)).rejects.toThrow("boom");
  });
});

describe("the in-progress payout", () => {
  it("writes INITIATED before calling the gateway, never after", async () => {
    initiateTransfer.mockResolvedValue({
      reference: "REF-7-ABC",
      transfer_code: "TRF_1",
      status: "pending",
    });

    await handleBadgeUnlocked(event);

    const marker = updates().findIndex(
      d => d.status === PayoutStatus.INITIATED
    );
    expect(marker).toBeGreaterThanOrEqual(0);

    const markerCall =
      prisma.cashbackPayout.update.mock.invocationCallOrder[marker];
    expect(markerCall).toBeLessThan(
      initiateTransfer.mock.invocationCallOrder[0]
    );
  });
});

describe("guards against paying twice", () => {
  it.each([
    PayoutStatus.PROCESSING,
    PayoutStatus.AWAITING_OTP,
    PayoutStatus.PAID,
  ])("never re-sends a payout already %s", async status => {
    givenPayout(status);

    await handleBadgeUnlocked(event);

    expect(initiateTransfer).not.toHaveBeenCalled();
    expect(prisma.cashbackPayout.update).not.toHaveBeenCalled();
  });

  it.each([PayoutStatus.CREATED, PayoutStatus.FAILED])(
    "re-drives a payout left at %s",
    async status => {
      givenPayout(status);
      initiateTransfer.mockResolvedValue({
        reference: "REF-7-ABC",
        transfer_code: "TRF_1",
        status: "pending",
      });

      await handleBadgeUnlocked(event);

      expect(initiateTransfer).toHaveBeenCalled();
    }
  );

  it("reuses the payout key as the transfer reference", async () => {
    // The reference is the idempotency key. Regenerating it per attempt is how
    // a retry turns into a second payment.
    initiateTransfer.mockResolvedValue({
      reference: "REF-7-ABC",
      transfer_code: "TRF_1",
      status: "pending",
    });

    await handleBadgeUnlocked(event);

    expect(initiateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "REF-7-ABC" })
    );
  });

  it("converts the amount to minor units", async () => {
    initiateTransfer.mockResolvedValue({
      reference: "REF-7-ABC",
      transfer_code: "TRF_1",
      status: "pending",
    });

    await handleBadgeUnlocked(event);

    // 300 naira -> 30000 kobo.
    expect(initiateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 30000 })
    );
  });
});

describe("payout method", () => {
  it("parks the payout when there are no bank details", async () => {
    prisma.payoutRecipient.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({
      name: "Ada",
      accountNumber: null,
      bankCode: null,
    });

    await handleBadgeUnlocked(event);

    expect(updates().at(-1)!.status).toBe(PayoutStatus.AWAITING_PAYOUT_METHOD);
    expect(initiateTransfer).not.toHaveBeenCalled();
  });

  it("creates the recipient on first use and stores it", async () => {
    prisma.payoutRecipient.findUnique.mockResolvedValue({
      recipientCode: null,
    });
    createTransferRecipient.mockResolvedValue({
      recipientCode: "RCP_new",
    });
    initiateTransfer.mockResolvedValue({
      reference: "REF-7-ABC",
      transfer_code: "TRF_1",
      status: "pending",
    });

    await handleBadgeUnlocked(event);

    expect(createTransferRecipient).toHaveBeenCalled();
    expect(prisma.payoutRecipient.upsert).toHaveBeenCalled();
    expect(initiateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ recipientCode: "RCP_new" })
    );
  });

  it("does not recreate a recipient that already exists", async () => {
    initiateTransfer.mockResolvedValue({
      reference: "REF-7-ABC",
      transfer_code: "TRF_1",
      status: "pending",
    });

    await handleBadgeUnlocked(event);

    expect(createTransferRecipient).not.toHaveBeenCalled();
  });

  it("leaves the payout untouched when recipient creation fails ambiguously", async () => {
    // The failure happens before the INITIATED marker, so the row must stay
    // CREATED.
    prisma.payoutRecipient.findUnique.mockResolvedValue({
      recipientCode: null,
    });
    createTransferRecipient.mockRejectedValue(new Error("socket hang up"));

    await expect(handleBadgeUnlocked(event)).rejects.toThrow();

    const written = updates();
    expect(written.some(d => d.status === PayoutStatus.INITIATED)).toBe(false);
    expect(written.at(-1)!.status).toBeUndefined();
  });
});

describe("bails out early on missing records", () => {
  it("ignores an unknown badge", async () => {
    prisma.badge.findUnique.mockResolvedValue(null);

    await handleBadgeUnlocked(event);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("ignores a badge the user does not hold", async () => {
    prisma.userBadge.findUnique.mockResolvedValue(null);

    await handleBadgeUnlocked(event);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
