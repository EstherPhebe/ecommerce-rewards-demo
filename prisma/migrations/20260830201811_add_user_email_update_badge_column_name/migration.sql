/*
  Warnings:

  - You are about to drop the column `threshold` on the `badges` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[achievement_threshold]` on the table `badges` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `achievement_threshold` to the `badges` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "badges_threshold_key";

-- AlterTable
ALTER TABLE "badges" DROP COLUMN "threshold",
ADD COLUMN     "achievement_threshold" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "badges_achievement_threshold_key" ON "badges"("achievement_threshold");
