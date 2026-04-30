-- Add missing columns to Subscription
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

-- Add missing column to Plan
ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "priceDisplay" TEXT;

-- Create GroupMember table
CREATE TABLE IF NOT EXISTS "GroupMember" (
  "id"         TEXT NOT NULL,
  "groupId"    TEXT NOT NULL,
  "telegramId" BIGINT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'member',
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId")
    REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GroupMember_groupId_telegramId_key" UNIQUE ("groupId", "telegramId")
);

CREATE INDEX IF NOT EXISTS "GroupMember_telegramId_idx" ON "GroupMember"("telegramId");
