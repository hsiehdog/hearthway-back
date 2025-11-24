/*
  Warnings:

  - You are about to drop the column `receipt_url` on the `expenses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "expense_payments" ADD COLUMN     "receipt_url" TEXT;

-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "receipt_url";
