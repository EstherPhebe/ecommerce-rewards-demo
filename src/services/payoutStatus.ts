import { PayoutStatus } from "../../generated/prisma/enums";
import type { TransferStatus } from "./paymentGateway";

const BY_TRANSFER_STATUS: Record<TransferStatus, PayoutStatus> = {
  pending: PayoutStatus.PROCESSING,
  processing: PayoutStatus.PROCESSING,
  // Accepted but frozen until an OTP is supplied-from response, no webhook
  otp: PayoutStatus.AWAITING_OTP,
  success: PayoutStatus.PAID,
  failed: PayoutStatus.FAILED,
  reversed: PayoutStatus.FAILED,
  abandoned: PayoutStatus.FAILED,
};

export function payoutStatusFor(transferStatus: TransferStatus): PayoutStatus {
  // An unrecognised status; let the webhook settle it(for server approval),
  // rather than guessing at PAID or FAILED.
  return BY_TRANSFER_STATUS[transferStatus] ?? PayoutStatus.PROCESSING;
}

//for `statusReason`.
export function reasonFor(status: PayoutStatus): string | null {
  if (status === PayoutStatus.AWAITING_OTP) {
    return "Awaiting OTP";
  }
  if (status === PayoutStatus.FAILED)
    return "Gateway reported a failed transfer";
  return null;
}
