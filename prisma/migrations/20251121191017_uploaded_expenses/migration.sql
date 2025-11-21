-- CreateEnum
CREATE TYPE "UploadParsingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "uploaded_expenses" (
    "id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "storage_bucket" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "parsing_status" "UploadParsingStatus" NOT NULL DEFAULT 'PENDING',
    "raw_text" TEXT,
    "parsed_json" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploaded_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uploaded_expenses_expense_id_idx" ON "uploaded_expenses"("expense_id");

-- CreateIndex
CREATE INDEX "uploaded_expenses_uploaded_by_id_idx" ON "uploaded_expenses"("uploaded_by_id");

-- AddForeignKey
ALTER TABLE "uploaded_expenses" ADD CONSTRAINT "uploaded_expenses_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_expenses" ADD CONSTRAINT "uploaded_expenses_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
