// Real payloads, captured from live test-mode calls.

export const RECIPIENT_CREATED = {
  status: true,
  message: "Transfer recipient created successfully",
  data: {
    active: true,
    currency: "NGN",
    recipient_code: "RCP_1a2b3c4d5e6f7g8",
    type: "nuban",
    details: {
      account_number: "0123456789",
      bank_code: "058",
      bank_name: "Guaranty Trust Bank",
    },
  },
};

// A transfer that needs an OTP before it moves. No webhook follows this.
export const TRANSFER_OTP = {
  status: true,
  message: "Transfer requires OTP to continue",
  data: {
    domain: "test",
    amount: 300000,
    currency: "NGN",
    reference: "REF-21-17882010829323D9FF7AD",
    source: "balance",
    reason: "badge:bronze",
    status: "otp",
    failures: null,
    transfer_code: "TRF_9cx2eo1myydqhr7c",
    transferred_at: null,
    id: 1027416438,
    createdAt: "2026-08-31T18:31:23.000Z",
    updatedAt: "2026-08-31T18:31:23.000Z",
  },
};

export const TRANSFER_PENDING = {
  status: true,
  message: "Transfer has been queued",
  data: {
    ...TRANSFER_OTP.data,
    status: "pending",
    transfer_code: "TRF_pendingexample01",
  },
};

export const ERROR_INVALID_RECIPIENT = {
  status: false,
  message: "Recipient specified is invalid",
  meta: {
    nextStep:
      "Provide a valid recipient. Ensure you are passing the recipient code in the recipient param",
  },
  type: "validation_error",
  code: "invalid_transfer_recipient",
};

export const ERROR_BARE = {
  status: false,
  message: "Transfer code is invalid",
};
