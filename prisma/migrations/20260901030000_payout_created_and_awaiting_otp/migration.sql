-- INITIATED changes meaning: it used to be the default ("row created, never
-- sent"), and now marks an in-flight attempt written just before the gateway
-- call. Existing rows have never been sent, so they map to CREATED.
BEGIN;
CREATE TYPE "PayoutStatus_new" AS ENUM ('CREATED', 'AWAITING_PAYOUT_METHOD', 'INITIATED', 'AWAITING_OTP', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
ALTER TABLE "cashback_payouts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "cashback_payouts" ALTER COLUMN "status" TYPE "PayoutStatus_new"
  USING (CASE "status"::text WHEN 'INITIATED' THEN 'CREATED' ELSE "status"::text END::"PayoutStatus_new");
ALTER TYPE "PayoutStatus" RENAME TO "PayoutStatus_old";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";
DROP TYPE "PayoutStatus_old";
ALTER TABLE "cashback_payouts" ALTER COLUMN "status" SET DEFAULT 'CREATED';
COMMIT;
