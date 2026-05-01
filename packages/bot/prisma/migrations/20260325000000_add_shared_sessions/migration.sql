-- CreateTable
CREATE TABLE "SharedSession" (
    "id" TEXT NOT NULL,
    "telegramUserId" BIGINT,
    "deviceId" TEXT,
    "waypoints" JSONB NOT NULL,
    "routeResult" JSONB,
    "standalonePois" JSONB NOT NULL,
    "measureSessions" JSONB NOT NULL,
    "appSettings" JSONB NOT NULL,
    "name" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "editToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedSession_editToken_key" ON "SharedSession"("editToken");

-- CreateIndex
CREATE INDEX "SharedSession_telegramUserId_idx" ON "SharedSession"("telegramUserId");

-- CreateIndex
CREATE INDEX "SharedSession_deviceId_idx" ON "SharedSession"("deviceId");

-- CreateIndex
CREATE INDEX "SharedSession_expiresAt_idx" ON "SharedSession"("expiresAt");
