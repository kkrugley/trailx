-- Migration: Add dynamic pricing tables (Plan + ProviderPricing)
-- Created: 2025-04-25

-- Create Plan table
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Create ProviderPricing table
CREATE TABLE "ProviderPricing" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "planId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "displayAmount" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderPricing_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique constraint for plan + provider combination
CREATE UNIQUE INDEX "ProviderPricing_planId_provider_key" ON "ProviderPricing"("planId", "provider");

-- Index for provider lookups
CREATE INDEX "ProviderPricing_provider_idx" ON "ProviderPricing"("provider");

-- Seed data: Plans
INSERT INTO "Plan" ("id", "label", "description", "days", "isActive", "sortOrder", "updatedAt") VALUES
('monthly', '1 месяц', 'TrailX Pro — доступ к групповым маршрутам, командам бота и синхронизации в реальном времени.', 30, true, 1, CURRENT_TIMESTAMP),
('annual', '1 год', 'TrailX Pro на 12 месяцев — экономия 25% по сравнению с ежемесячной оплатой.', 365, true, 2, CURRENT_TIMESTAMP);

-- Seed data: Provider pricing
-- Note: Using same prices as current hardcoded values for backward compatibility
INSERT INTO "ProviderPricing" ("planId", "provider", "amount", "currency", "displayAmount", "enabled", "updatedAt") VALUES
-- Telegram Stars
('monthly', 'stars', '5', 'XTR', '5 ⭐', true, CURRENT_TIMESTAMP),
('annual', 'stars', '50', 'XTR', '50 ⭐', true, CURRENT_TIMESTAMP),

-- TON (direct via toncenter.com)
('monthly', 'ton', '100000000', 'TON', '0.1 TON', true, CURRENT_TIMESTAMP),
('annual', 'ton', '1000000000', 'TON', '1 TON', true, CURRENT_TIMESTAMP),

-- CryptoPay (via @CryptoBot)
('monthly', 'cryptopay', '100000000', 'TON', '0.1 TON', true, CURRENT_TIMESTAMP),
('annual', 'cryptopay', '1000000000', 'TON', '1 TON', true, CURRENT_TIMESTAMP),

-- WebPay.by (USD cents)
('monthly', 'webpay', '500', 'USD', '5 USD', true, CURRENT_TIMESTAMP),
('annual', 'webpay', '4500', 'USD', '45 USD', true, CURRENT_TIMESTAMP),

-- bePaid (USD cents) — currently inactive but seeded for future use
('monthly', 'bepaid', '500', 'USD', '5 USD', false, CURRENT_TIMESTAMP),
('annual', 'bepaid', '4500', 'USD', '45 USD', false, CURRENT_TIMESTAMP);
