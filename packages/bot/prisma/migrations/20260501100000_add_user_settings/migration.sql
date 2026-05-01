-- CreateTable
CREATE TABLE "UserSettings" (
    "telegramId" BIGINT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "routeProfile" TEXT NOT NULL DEFAULT 'bike',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("telegramId")
);
