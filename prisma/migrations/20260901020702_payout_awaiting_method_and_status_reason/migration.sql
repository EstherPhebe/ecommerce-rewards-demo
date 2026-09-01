-- AlterEnum
ALTER TYPE "PayoutStatus" ADD VALUE 'AWAITING_PAYOUT_METHOD';

-- AlterTable
ALTER TABLE "cashback_payouts" ADD COLUMN     "status_reason" TEXT;
