-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('TRAVELLING', 'REACHED_COMPANY', 'WAITING_FOR_CONTACT', 'MEETING_IN_PROGRESS', 'REQUIREMENT_DISCUSSION', 'FOLLOW_UP_DISCUSSION', 'BREAK', 'VISIT_COMPLETED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('OPEN', 'BOOKED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'BOUNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiCallStatus" AS ENUM ('QUEUED', 'INITIATED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'CLIENT_REVIEW', 'REVISION_REQUESTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuotationDecision" AS ENUM ('PENDING', 'YES', 'NO', 'MAYBE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FollowUpStatus" ADD VALUE 'PENDING_ACCEPTANCE';
ALTER TYPE "FollowUpStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "FollowUpStatus" ADD VALUE 'WAITING_FOR_DECISION';
ALTER TYPE "FollowUpStatus" ADD VALUE 'CLOSED';

-- AlterEnum
ALTER TYPE "ProjectRequired" ADD VALUE 'COLLABORATION';

-- AlterEnum
ALTER TYPE "RoleName" ADD VALUE 'TECHNICAL_TEAM';

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "entity" TEXT,
ADD COLUMN     "entityId" TEXT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneNormalized" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "attachmentUrl" TEXT,
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "body" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "visitId" TEXT,
ADD COLUMN     "voiceScript" TEXT;

-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "aiCallConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiCallEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiCallOffsetMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "aiCallQueuedAt" TIMESTAMP(3),
ADD COLUMN     "bookingRequestedAt" TIMESTAMP(3),
ADD COLUMN     "clientConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "declineReason" TEXT,
ADD COLUMN     "declinedAt" TIMESTAMP(3),
ADD COLUMN     "delegatedToId" TEXT,
ADD COLUMN     "handoverNotes" TEXT,
ADD COLUMN     "originalOwnerId" TEXT NOT NULL,
ADD COLUMN     "overdueAt" TIMESTAMP(3),
ADD COLUMN     "quotationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "remindedAt" TIMESTAMP(3),
ADD COLUMN     "reminderEmailQueuedAt" TIMESTAMP(3),
ADD COLUMN     "returnedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "lostAt" TIMESTAMP(3),
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "reengageAt" TIMESTAMP(3),
ADD COLUMN     "wonAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "clientDecision" "QuotationDecision" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "clientFeedback" TEXT,
ADD COLUMN     "decisionReason" TEXT,
ADD COLUMN     "deliveryTimeline" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "discountPercent" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "discussionOwnerId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "responseTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "responseTokenHash" TEXT,
ADD COLUMN     "responseTokenUsedAt" TIMESTAMP(3),
ADD COLUMN     "subtotalAmount" DECIMAL(65,30),
ADD COLUMN     "taxAmount" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "taxPercent" DECIMAL(65,30) DEFAULT 18,
ADD COLUMN     "validUntil" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "isSalesTeam" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "profilePhotoUrl" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestedRole" "RoleName",
ALTER COLUMN "isActive" SET DEFAULT false;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "assignmentId" TEXT,
ADD COLUMN     "autoClosedAt" TIMESTAMP(3),
ADD COLUMN     "collaborationDetails" TEXT,
ADD COLUMN     "collaborationType" TEXT,
ADD COLUMN     "emailCorrectionNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "emailCorrectionReason" TEXT,
ADD COLUMN     "emailCorrectionRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailLastCorrectedAt" TIMESTAMP(3),
ADD COLUMN     "emailUnavailableReason" TEXT,
ADD COLUMN     "noRequirementReason" TEXT,
ADD COLUMN     "revisitAfter" TEXT;

-- CreateTable
CREATE TABLE "EmailVerificationCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDuplicateAttempt" (
    "id" TEXT NOT NULL,
    "attemptedName" TEXT NOT NULL,
    "attemptedPhone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "matchedCompanyId" TEXT,
    "matchedCompanyName" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BLOCKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDuplicateAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HourlyActivity" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ActivityStatus" NOT NULL,
    "note" TEXT,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "accuracyM" DECIMAL(65,30),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HourlyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingBooking" (
    "id" TEXT NOT NULL,
    "followUpId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'OPEN',
    "availableSlots" JSONB NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "selectedSlot" TIMESTAMP(3),
    "clientName" TEXT,
    "clientEmail" TEXT,
    "clientNote" TEXT,
    "bookedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCallLog" (
    "id" TEXT NOT NULL,
    "followUpId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "toPhone" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "status" "AiCallStatus" NOT NULL DEFAULT 'QUEUED',
    "providerCallId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "initiatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "link" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailVerificationCode_userId_createdAt_idx" ON "EmailVerificationCode"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetCode_userId_createdAt_idx" ON "PasswordResetCode"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyDuplicateAttempt_normalizedPhone_createdAt_idx" ON "CompanyDuplicateAttempt"("normalizedPhone", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyDuplicateAttempt_createdAt_idx" ON "CompanyDuplicateAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "WorkAssignment_assignedToId_scheduledAt_status_idx" ON "WorkAssignment"("assignedToId", "scheduledAt", "status");

-- CreateIndex
CREATE INDEX "WorkAssignment_companyId_idx" ON "WorkAssignment"("companyId");

-- CreateIndex
CREATE INDEX "HourlyActivity_visitId_capturedAt_idx" ON "HourlyActivity"("visitId", "capturedAt");

-- CreateIndex
CREATE INDEX "HourlyActivity_userId_capturedAt_idx" ON "HourlyActivity"("userId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingBooking_followUpId_key" ON "MeetingBooking"("followUpId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingBooking_tokenHash_key" ON "MeetingBooking"("tokenHash");

-- CreateIndex
CREATE INDEX "MeetingBooking_status_expiresAt_idx" ON "MeetingBooking"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "MeetingBooking_selectedSlot_idx" ON "MeetingBooking"("selectedSlot");

-- CreateIndex
CREATE INDEX "AiCallLog_status_scheduledFor_idx" ON "AiCallLog"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "AiCallLog_followUpId_idx" ON "AiCallLog"("followUpId");

-- CreateIndex
CREATE INDEX "AiCallLog_companyId_createdAt_idx" ON "AiCallLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Company_phoneNormalized_idx" ON "Company"("phoneNormalized");

-- CreateIndex
CREATE INDEX "EmailLog_visitId_idx" ON "EmailLog"("visitId");

-- CreateIndex
CREATE INDEX "FollowUp_originalOwnerId_scheduledAt_status_idx" ON "FollowUp"("originalOwnerId", "scheduledAt", "status");

-- CreateIndex
CREATE INDEX "FollowUp_delegatedToId_scheduledAt_status_idx" ON "FollowUp"("delegatedToId", "scheduledAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_responseTokenHash_key" ON "Quotation"("responseTokenHash");

-- CreateIndex
CREATE INDEX "Visit_assignmentId_idx" ON "Visit"("assignmentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationCode" ADD CONSTRAINT "EmailVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetCode" ADD CONSTRAINT "PasswordResetCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WorkAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourlyActivity" ADD CONSTRAINT "HourlyActivity_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HourlyActivity" ADD CONSTRAINT "HourlyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_originalOwnerId_fkey" FOREIGN KEY ("originalOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_delegatedToId_fkey" FOREIGN KEY ("delegatedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingBooking" ADD CONSTRAINT "MeetingBooking_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCallLog" ADD CONSTRAINT "AiCallLog_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "FollowUp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCallLog" ADD CONSTRAINT "AiCallLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCallLog" ADD CONSTRAINT "AiCallLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

