-- CreateTable
CREATE TABLE "DailyEnergyRecord" (
    "id" TEXT NOT NULL,
    "pn" TEXT NOT NULL,
    "sn" TEXT NOT NULL,
    "devcode" TEXT NOT NULL,
    "devaddr" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "generatedTodayKwh" DECIMAL(12,3),
    "consumedTodayKwh" DECIMAL(12,3),
    "batteryChargedTodayKwh" DECIMAL(12,3),
    "batteryDischargedTodayKwh" DECIMAL(12,3),
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyEnergyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyEnergyRecord_pn_sn_devcode_devaddr_day_key" ON "DailyEnergyRecord"("pn", "sn", "devcode", "devaddr", "day");

-- CreateIndex
CREATE INDEX "DailyEnergyRecord_pn_sn_devcode_devaddr_day_idx" ON "DailyEnergyRecord"("pn", "sn", "devcode", "devaddr", "day");
