-- CreateEnum
CREATE TYPE "UploadProcessingStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "uploaded_expenses" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "processing_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processing_status" "UploadProcessingStatus" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "started_at" TIMESTAMP(3);
