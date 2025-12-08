-- CreateEnum
CREATE TYPE "TripItineraryItemType" AS ENUM ('FLIGHT', 'LODGING', 'MEAL', 'ACTIVITY', 'TRANSPORT', 'NOTE', 'OTHER');

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "trip_itinerary_item_id" TEXT;

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "base_currency" TEXT,
ADD COLUMN     "end_date" DATE,
ADD COLUMN     "primary_location" TEXT,
ADD COLUMN     "start_date" DATE;

-- CreateTable
CREATE TABLE "trip_itinerary_items" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "type" "TripItineraryItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_date_time" TIMESTAMP(3) NOT NULL,
    "end_date_time" TIMESTAMP(3),
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location_name" TEXT,
    "location_address" TEXT,
    "location_url" TEXT,
    "confirmation_code" TEXT,
    "provider" TEXT,
    "reference_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_itinerary_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_itinerary_items_group_id_idx" ON "trip_itinerary_items"("group_id");

-- CreateIndex
CREATE INDEX "trip_itinerary_items_start_date_time_idx" ON "trip_itinerary_items"("start_date_time");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_itinerary_item_id_fkey" FOREIGN KEY ("trip_itinerary_item_id") REFERENCES "trip_itinerary_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_itinerary_items" ADD CONSTRAINT "trip_itinerary_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
