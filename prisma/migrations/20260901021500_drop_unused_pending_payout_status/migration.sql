-- Legacy rows from when PENDING was the column default. They mean "created,
-- nothing sent to the gateway", which is exactly what INITIATED means now.
UPDATE "cashback_payouts" SET "status" = 'INITIATED' WHERE "status" = 'PENDING';

-- AlterEnum: Postgres cannot drop a value in place, so the type is recreated.
BEGIN;
CREATE TYPE "PayoutStatus_new" AS ENUM ('INITIATED', 'AWAITING_PAYOUT_METHOD', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
ALTER TABLE "cashback_payouts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "cashback_payouts" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING ("status"::text::"PayoutStatus_new");
ALTER TYPE "PayoutStatus" RENAME TO "PayoutStatus_old";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";
DROP TYPE "PayoutStatus_old";
ALTER TABLE "cashback_payouts" ALTER COLUMN "status" SET DEFAULT 'INITIATED';
COMMIT;
