-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('PROJECT', 'TRIP');

-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('EVEN', 'PERCENT', 'SHARES');

-- CreateTable
CREATE TABLE "group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GroupType" NOT NULL DEFAULT 'PROJECT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_member" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "payer_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    "note" TEXT,
    "split_type" "SplitType" NOT NULL,
    "percent_map" JSONB,
    "share_map" JSONB,
    "receipt_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_participant" (
    "id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "share_amount" DECIMAL(12,2),

    CONSTRAINT "expense_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_line_item" (
    "id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unit_amount" DECIMAL(12,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "from_member_id" TEXT NOT NULL,
    "to_member_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "note" TEXT,
    "marked_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_member_group_id_idx" ON "group_member"("group_id");

-- CreateIndex
CREATE INDEX "expense_group_id_idx" ON "expense"("group_id");

-- CreateIndex
CREATE INDEX "expense_payer_id_idx" ON "expense"("payer_id");

-- CreateIndex
CREATE INDEX "expense_participant_expense_id_idx" ON "expense_participant"("expense_id");

-- CreateIndex
CREATE INDEX "expense_participant_member_id_idx" ON "expense_participant"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_participant_expense_id_member_id_key" ON "expense_participant"("expense_id", "member_id");

-- CreateIndex
CREATE INDEX "expense_line_item_expense_id_idx" ON "expense_line_item"("expense_id");

-- CreateIndex
CREATE INDEX "settlement_group_id_idx" ON "settlement"("group_id");

-- CreateIndex
CREATE INDEX "settlement_from_member_id_idx" ON "settlement"("from_member_id");

-- CreateIndex
CREATE INDEX "settlement_to_member_id_idx" ON "settlement"("to_member_id");

-- AddForeignKey
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_participant" ADD CONSTRAINT "expense_participant_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_participant" ADD CONSTRAINT "expense_participant_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_line_item" ADD CONSTRAINT "expense_line_item_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "group_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
