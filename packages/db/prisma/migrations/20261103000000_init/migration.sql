-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "PickupSource" AS ENUM ('MANUAL', 'SMS');

-- CreateEnum
CREATE TYPE "SmsIngestStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'CREATED', 'LINKED_EXISTING', 'REVIEW', 'IGNORED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Whitelist" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "wechatAppId" TEXT,
    "wechatOpenId" TEXT,
    "wechatUnionId" TEXT,
    "displayName" TEXT NOT NULL,
    "role" "FamilyRole" NOT NULL DEFAULT 'MEMBER',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpressPickup" (
    "id" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(128),
    "rawInfo" TEXT,
    "address" VARCHAR(200) NOT NULL,
    "pickupCode" VARCHAR(80) NOT NULL,
    "recipientName" VARCHAR(80),
    "status" "PickupStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "source" "PickupSource" NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT,
    "doneById" TEXT,

    CONSTRAINT "ExpressPickup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsIngest" (
    "id" TEXT NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "clientEventId" VARCHAR(128),
    "content" TEXT NOT NULL,
    "sender" VARCHAR(160),
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "device" VARCHAR(160) NOT NULL,
    "status" "SmsIngestStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorCode" VARCHAR(80),
    "pickupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsIngest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Whitelist_userId_key" ON "Whitelist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Whitelist_email_key" ON "Whitelist"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Whitelist_wechatAppId_wechatOpenId_key" ON "Whitelist"("wechatAppId", "wechatOpenId");

-- CreateIndex
CREATE UNIQUE INDEX "Whitelist_wechatUnionId_key" ON "Whitelist"("wechatUnionId");

-- CreateIndex
CREATE INDEX "ExpressPickup_status_createdAt_id_idx" ON "ExpressPickup"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "ExpressPickup_status_pickupCode_updatedAt_idx" ON "ExpressPickup"("status", "pickupCode", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExpressPickup_createdById_idempotencyKey_key" ON "ExpressPickup"("createdById", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "SmsIngest_fingerprint_key" ON "SmsIngest"("fingerprint");

-- CreateIndex
CREATE INDEX "SmsIngest_status_createdAt_idx" ON "SmsIngest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SmsIngest_pickupId_idx" ON "SmsIngest"("pickupId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsIngest_device_clientEventId_key" ON "SmsIngest"("device", "clientEventId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Whitelist" ADD CONSTRAINT "Whitelist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressPickup" ADD CONSTRAINT "ExpressPickup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressPickup" ADD CONSTRAINT "ExpressPickup_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsIngest" ADD CONSTRAINT "SmsIngest_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "ExpressPickup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
