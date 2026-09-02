import axios, { AxiosResponse } from "axios";
import env from "../config/env";
import { PayoutRecipientType } from "../../generated/prisma/enums";

const baseUrl = env.PAYSTACK_URL;
const secretKey = env.PAYSTACK_SECRET_KEY;

const headers = {
  Authorization: `Bearer ${secretKey}`,
  "Content-Type": "application/json",
};

const config = { headers, validateStatus: () => true };

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data?: T;
  meta?: T;
  code: string;
  type?: string;
}

export class PaystackError extends Error {
  readonly httpStatus: number;
  readonly type?: string;
  readonly code?: string;
  readonly meta: any;

  constructor(response: AxiosResponse<PaystackResponse<unknown>>) {
    const body = response.data;
    super(
      `Paystack rejected the request (HTTP ${response.status}` +
        (body?.code ? `, ${body.code}` : "") +
        `): ` +
        (body?.message ?? response.statusText ?? "no response body") +
        (body?.meta ?? "")
    );
    this.name = "PaystackError";
    this.httpStatus = response.status;
    this.type = body?.type;
    this.code = body?.code;
    this.meta = body?.meta;
  }
}

/**
 * True when Paystack answered and refused: the request definitively did not
 * create a transfer, so the payout can be marked FAILED.
 *
 * Anything else — a timeout, a dropped connection, a 5xx, a 429 — is ambiguous.
 * The request may have been received and acted on, so the payout must NOT be
 * marked FAILED; it has to be verified against the gateway instead.
 */
export function isDefinitiveRejection(error: unknown): error is PaystackError {
  return (
    error instanceof PaystackError &&
    error.httpStatus < 500 &&
    error.httpStatus !== 429
  );
}

function unwrap<T>(response: AxiosResponse<PaystackResponse<T>>): T {
  const body = response.data;
  if (!body?.status || !body.data) {
    throw new PaystackError(response);
  }
  return body.data;
}

export interface CreateRecipientRequest {
  type: PayoutRecipientType;
  name: string;
  currency?: string;
  accountNumber?: string;
  bankCode?: string;
  //just focused on account for now
}

export interface CreateRecipientResult {
  recipientCode: string;
}

export async function createTransferRecipient(
  req: CreateRecipientRequest
): Promise<CreateRecipientResult> {
  const response = await axios.post<
    PaystackResponse<{ recipient_code: string }>
  >(
    `${baseUrl}/transferrecipient`,
    {
      type: "nuban",
      name: req.name,
      currency: req.currency ?? "NGN",
      account_number: req.accountNumber,
      bank_code: req.bankCode,
    },
    config
  );

  return { recipientCode: unwrap(response).recipient_code };
}

export interface TransferRequest {
  reference: string;
  recipientCode: string;
  amount: number;
  reason: string;
}

export interface finalizeTransferRequest {
  OTP: string;
  transfer_code: string;
}

export type TransferStatus =
  | "pending"
  | "otp"
  | "processing"
  | "success"
  | "failed"
  | "reversed"
  | "abandoned";

export interface TransferResult {
  reference: string;
  transfer_code: string; // provider's transfer code, e.g. TRF_9cx2eo1myydqhr7c
  status: TransferStatus;
}

export interface finalizeTransferResult {
  OTP: string;
  transferCode: string;
}

interface PaystackTransfer {
  reference: string;
  transfer_code: string;
  status: TransferResult["status"];
}

export async function initiateTransfer(
  req: TransferRequest
): Promise<TransferResult> {
  const response = await axios.post<PaystackResponse<PaystackTransfer>>(
    `${baseUrl}/transfer`,
    {
      source: "balance",
      amount: req.amount,
      recipient: req.recipientCode,
      reference: req.reference,
      reason: req.reason,
    },
    config
  );

  const transfer = unwrap(response);
  console.log(
    `Initiate transfer ${req.amount} to ${req.recipientCode} (ref=${req.reference})`
  );

  return {
    reference: transfer.reference,
    transfer_code: transfer.transfer_code,
    status: transfer.status,
  };
}

// Completes a transfer
export async function finalizeTransfer(
  otp: string,
  transferCode: string
): Promise<PaystackTransfer> {
  const response = await axios.post<PaystackResponse<PaystackTransfer>>(
    `${baseUrl}/transfer/finalize_transfer`,
    {
      transfer_code: transferCode,
      otp,
    },
    config
  );

  const transfer = unwrap(response);

  return {
    reference: transfer.reference,
    transfer_code: transfer.transfer_code,
    status: transfer.status,
  };
}
