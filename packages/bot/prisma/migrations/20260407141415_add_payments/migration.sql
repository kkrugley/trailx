/*
  Warnings:

  - A unique constraint covering the columns `[telegramPaymentChargeId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amount` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plan` to the `Subscription` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "amount" INTEGER NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BYN',
ADD COLUMN     "plan" TEXT NOT NULL,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerPaymentChargeId" TEXT,
ADD COLUMN     "telegramPaymentChargeId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'active';

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "plan" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BYN',
    "telegramPaymentChargeId" TEXT NOT NULL,
    "providerPaymentChargeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_telegramPaymentChargeId_key" ON "PaymentRecord"("telegramPaymentChargeId");

-- CreateIndex
CREATE INDEX "PaymentRecord_chatId_idx" ON "PaymentRecord"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_telegramPaymentChargeId_key" ON "Subscription"("telegramPaymentChargeId");
