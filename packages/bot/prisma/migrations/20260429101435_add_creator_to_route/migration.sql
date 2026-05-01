-- AlterTable
ALTER TABLE "ProviderPricing" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "creatorTelegramId" BIGINT,
ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "elevationM" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Route_creatorTelegramId_idx" ON "Route"("creatorTelegramId");
