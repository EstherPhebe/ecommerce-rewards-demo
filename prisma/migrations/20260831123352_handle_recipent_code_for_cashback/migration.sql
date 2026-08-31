-- CreateEnum
CREATE TYPE "PayoutRecipientType" AS ENUM ('NUBAN', 'AUTHORIZATION');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_number" TEXT,
ADD COLUMN     "bank_code" TEXT;

-- CreateTable
CREATE TABLE "payout_recipients" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "PayoutRecipientType" NOT NULL DEFAULT 'NUBAN',
    "recipient_code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payout_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_recipients_user_id_key" ON "payout_recipients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_recipients_recipient_code_key" ON "payout_recipients"("recipient_code");

-- AddForeignKey
ALTER TABLE "payout_recipients" ADD CONSTRAINT "payout_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
