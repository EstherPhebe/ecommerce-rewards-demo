import { describe, it, expect } from "@jest/globals";
import { PayoutStatus } from "../../generated/prisma/enums";
import { payoutStatusFor, reasonFor } from "../services/payoutStatus";
import type { TransferStatus } from "../services/paymentGateway";

describe("payoutStatusFor", () => {
  it("treats a freshly accepted transfer as in flight", () => {
    expect(payoutStatusFor("pending")).toBe(PayoutStatus.PROCESSING);
    expect(payoutStatusFor("processing")).toBe(PayoutStatus.PROCESSING);
  });

  it("parks an OTP transfer instead of pretending it is in flight", () => {
    expect(payoutStatusFor("otp")).toBe(PayoutStatus.AWAITING_OTP);
  });

  it("settles a successful transfer", () => {
    expect(payoutStatusFor("success")).toBe(PayoutStatus.PAID);
  });

  it("collapses every failure onto FAILED", () => {
    expect(payoutStatusFor("failed")).toBe(PayoutStatus.FAILED);
    expect(payoutStatusFor("reversed")).toBe(PayoutStatus.FAILED);
    expect(payoutStatusFor("abandoned")).toBe(PayoutStatus.FAILED);
  });

  it("falls back to PROCESSING for a status Paystack adds later", () => {
    //  Let the webhook settle it( for server approval).
    expect(payoutStatusFor("some_new_status" as TransferStatus)).toBe(
      PayoutStatus.PROCESSING
    );
  });

  it("maps a real Paystack OTP response", () => {
    const data = {
      amount: 30000,
      currency: "NGN",
      reference: "REF-21-17882010829323D9FF7AD",
      source: "balance",
      reason: "badge:bronze",
      status: "otp" as const,
      transfer_code: "TRF_9cx2eo1myydqhr7c",
      transferred_at: null,
    };

    const status = payoutStatusFor(data.status);

    expect(status).toBe(PayoutStatus.AWAITING_OTP);
    // Asserting it mentions OTP, not the exact wording or route — those change.
    expect(reasonFor(status)).toMatch(/otp/i);
  });
});

describe("reasonFor", () => {
  it("explains the states a reader cannot infer", () => {
    expect(reasonFor(PayoutStatus.AWAITING_OTP)).toMatch(/OTP/);
    expect(reasonFor(PayoutStatus.FAILED)).toBeTruthy();
  });

  it("leaves self-explanatory states unannotated", () => {
    // A null here is what clears a stale reason off the row.
    expect(reasonFor(PayoutStatus.PROCESSING)).toBeNull();
    expect(reasonFor(PayoutStatus.PAID)).toBeNull();
  });
});
