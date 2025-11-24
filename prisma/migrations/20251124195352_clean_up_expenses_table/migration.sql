/*
  Warnings:

  - You are about to drop the column `category` on the `expenses` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `expenses` table. All the data in the column will be lost.
  - You are about to drop the column `percent_map` on the `expenses` table. All the data in the column will be lost.
  - You are about to drop the column `share_map` on the `expenses` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "expenses" DROP COLUMN "category",
DROP COLUMN "note",
DROP COLUMN "percent_map",
DROP COLUMN "share_map",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Expense';
