import axios, { AxiosResponse } from "axios";
import { PayoutRecipientType } from "../../generated/prisma/enums";

const baseUrl = process.env.PAYSTACK_URL;
const secretKey = process.env.PAYSTACK_SECRET_KEY;

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

export interface TransferResult {
  reference: string;
  transfer_code: string; // provider's transfer code
  status: "success" | "failed" | "reversed";
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

  console.log("initialize", response.data);
  const transfer = unwrap(response);
  console.log("#######transfer", transfer);
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

export interface InitializeTransactionResult {
  reference: string;
  access_code: string;
  authorization_url: string;
}

export async function initializeTransaction(): Promise<InitializeTransactionResult> {
  const response = await axios.post<
    PaystackResponse<{
      reference: string;
      access_code: string;
      authorization_url: string;
    }>
  >(
    `${baseUrl}/transaction/initialize`,
    {
      email: "customer@email.com",
      amount: "2000000",
    },
    config
  );

  const transaction = unwrap(response);

  return {
    reference: transaction.reference,
    access_code: transaction.access_code,
    authorization_url: transaction.authorization_url,
  };
}
