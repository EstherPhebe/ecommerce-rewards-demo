import "dotenv/config";
import { z } from "zod";

const blankIsMissing = <T extends z.ZodType>(schema: T) =>
  z.preprocess(value => (value === "" ? undefined : value), schema);

const schema = z.object({
  NODE_ENV: blankIsMissing(
    z
      .enum(["development", "test", "staging", "production"])
      .default("development")
  ),
  APP_PORT: blankIsMissing(z.coerce.number().int().positive().default(3000)),
  ALLOWED_ORIGINS: blankIsMissing(z.string().default("")),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AMQP_URL: z.string().min(1, "AMQP_URL is required"),
  EXCHANGE: blankIsMissing(z.string().min(1).default("rewards")),

  // Fraud guard
  MIN_ORDER_AMOUNT: blankIsMissing(
    z.coerce.number().int().nonnegative().default(1000)
  ),

  // Broker retry policy.
  MAX_RETRIES: blankIsMissing(z.coerce.number().int().positive().default(5)),
  RETRY_DELAY_MS: blankIsMissing(
    z.coerce.number().int().positive().default(10000)
  ),
  BADGE_REWARD_AMOUNT: blankIsMissing(
    z.coerce.number().positive().default(300)
  ),

  PAYSTACK_URL: blankIsMissing(z.url().default("https://api.paystack.co")),
  PAYSTACK_SECRET_KEY: z
    .string()
    .min(1, "PAYSTACK_SECRET_KEY is required (it also verifies webhooks)"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Report every problem at once.ss
  const problems = parsed.error.issues
    .map(issue => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${problems}`);
}

const raw = parsed.data;

const env = {
  ...raw,
  isDevelopment: raw.NODE_ENV === "development",
  // Parsed here so callers get a list rather than re-splitting a string.
  ALLOWED_ORIGINS: raw.ALLOWED_ORIGINS.split(",")
    .map(origin => origin.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;
export default env;
