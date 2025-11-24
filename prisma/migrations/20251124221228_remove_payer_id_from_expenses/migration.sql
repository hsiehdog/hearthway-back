/*
  Warnings:

  - You are about to drop the column `payer_id` on the `expenses` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_payer_id_fkey";

-- DropIndex
DROP INDEX "expenses_payer_id_idx";

-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "payer_id";
