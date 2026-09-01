import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  RECIPIENT_CREATED,
  TRANSFER_OTP,
  TRANSFER_PENDING,
  ERROR_INVALID_RECIPIENT,
  ERROR_BARE,
} from "./fixtures/paystack";

jest.mock("axios");

const BASE_URL = "https://api.paystack.test";
const SECRET = "sk_test_dummy";

type Gateway = typeof import("../services/paymentGateway");
// An untyped jest.Mock infers its argument as `never`, so the signature is
// spelled out here.
type PostMock = jest.Mock<
  (url: string, body?: unknown, config?: unknown) => Promise<unknown>
>;

let gateway: Gateway;
let post: PostMock;

// Shapes an axios response the way the gateway sees it.
const reply = (status: number, data: unknown, statusText = "") => ({
  status,
  statusText,
  data,
  headers: {},
  config: {},
});

beforeEach(() => {
  jest.resetModules();
  process.env.PAYSTACK_URL = BASE_URL;
  process.env.PAYSTACK_SECRET_KEY = SECRET;

  const axios = require("axios");
  axios.post = jest.fn();
  post = axios.post as PostMock;

  gateway = require("../services/paymentGateway");
});

describe("createTransferRecipient — what we send", () => {
  beforeEach(() => {
    post.mockResolvedValue(reply(200, RECIPIENT_CREATED));
  });

  it("posts to the recipient endpoint with the bearer token", async () => {
    await gateway.createTransferRecipient({
      type: "NUBAN" as never,
      name: "Ada",
      accountNumber: "0123456789",
      bankCode: "058",
    });

    const [url, , config] = post.mock.calls[0] as [string, unknown, any];

    expect(url).toBe(`${BASE_URL}/transferrecipient`);
    expect(config.headers.Authorization).toBe(`Bearer ${SECRET}`);
  });

  it("sends snake_case bank fields, as the API expects", async () => {
    await gateway.createTransferRecipient({
      type: "NUBAN" as never,
      name: "Ada",
      accountNumber: "0123456789",
      bankCode: "058",
    });

    const body = post.mock.calls[0][1] as Record<string, unknown>;

    expect(body).toMatchObject({
      type: "nuban",
      name: "Ada",
      account_number: "0123456789",
      bank_code: "058",
    });
  });

  it("lets an explicit currency override the default", async () => {
    await gateway.createTransferRecipient({
      type: "NUBAN" as never,
      name: "Ada",
      currency: "GHS",
      accountNumber: "0123456789",
      bankCode: "058",
    });

    expect(post.mock.calls[0][1]).toMatchObject({ currency: "GHS" });
  });
});

describe("unwrapping the response envelope", () => {
  it("returns the payload, not the envelope around it", async () => {
    post.mockResolvedValue(reply(200, RECIPIENT_CREATED));

    const result = await gateway.createTransferRecipient({
      type: "NUBAN" as never,
      name: "Ada",
      accountNumber: "0123456789",
      bankCode: "058",
    });

    expect(result).toEqual({
      recipientCode: RECIPIENT_CREATED.data.recipient_code,
    });
  });

  it("passes the transfer status through untouched", async () => {
    post.mockResolvedValue(reply(200, TRANSFER_OTP));

    const result = await gateway.initiateTransfer({
      reference: "REF-1",
      recipientCode: "RCP_1",
      amount: 30000,
      reason: "badge:bronze",
    });

    expect(result).toEqual({
      reference: TRANSFER_OTP.data.reference,
      transfer_code: TRANSFER_OTP.data.transfer_code,
      status: "otp",
    });
  });

  it("reports pending for an ordinary queued transfer", async () => {
    post.mockResolvedValue(reply(200, TRANSFER_PENDING));

    const result = await gateway.initiateTransfer({
      reference: "REF-1",
      recipientCode: "RCP_1",
      amount: 30000,
      reason: "badge:bronze",
    });

    expect(result.status).toBe("pending");
  });
});

describe("error handling", () => {
  const initiate = () =>
    gateway.initiateTransfer({
      reference: "REF-1",
      recipientCode: "RCP_bad",
      amount: 30000,
      reason: "badge:bronze",
    });

  it("throws on a 400 that carries no data", async () => {
    post.mockResolvedValue(reply(400, ERROR_INVALID_RECIPIENT, "Bad Request"));

    await expect(initiate()).rejects.toThrow(gateway.PaystackError);
  });

  it("keeps the provider's own code and message", async () => {
    post.mockResolvedValue(reply(400, ERROR_INVALID_RECIPIENT, "Bad Request"));

    const error = await initiate().catch(e => e);

    expect(error.code).toBe("invalid_transfer_recipient");
    expect(error.type).toBe("validation_error");
    expect(error.httpStatus).toBe(400);
    expect(error.message).toContain("Recipient specified is invalid");
  });

  it("survives an error with no code and no meta", async () => {
    post.mockResolvedValue(reply(400, ERROR_BARE, "Bad Request"));

    const error = await initiate().catch(e => e);

    expect(error.message).toContain("Transfer code is invalid");
    expect(error.code).toBeUndefined();
  });

  it("does not print undefined when a proxy returns HTML", async () => {
    // A gateway timeout returns no envelope at all, so message/code are absent.
    post.mockResolvedValue(
      reply(502, "<html>Bad Gateway</html>", "Bad Gateway")
    );

    const error = await initiate().catch(e => e);

    expect(error.message).toContain("502");
    expect(error.message).not.toContain("undefined");
  });
});
