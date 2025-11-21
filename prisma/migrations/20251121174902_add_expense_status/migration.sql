-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PAID', 'REIMBURSED');

-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_payer_id_fkey";

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "payer_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "group_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
