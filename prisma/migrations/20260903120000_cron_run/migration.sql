-- CreateTable
CREATE TABLE "CronRun" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "schedule" TEXT,
    "userAgent" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "accounts" INTEGER NOT NULL,
    "devices" INTEGER NOT NULL,
    "saved" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronRun_createdAt_idx" ON "CronRun"("createdAt");
