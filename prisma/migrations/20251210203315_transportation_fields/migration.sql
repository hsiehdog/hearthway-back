-- CreateEnum
CREATE TYPE "TripTransportMode" AS ENUM ('FLIGHT', 'TRAIN', 'CAR', 'RENTAL_CAR', 'RIDE_SHARE', 'BUS', 'FERRY', 'OTHER');

-- CreateEnum
CREATE TYPE "TripLocationType" AS ENUM ('AIRPORT', 'TRAIN_STATION', 'CITY', 'ADDRESS', 'PORT', 'OTHER');

-- AlterTable
ALTER TABLE "trip_itinerary_items" ADD COLUMN     "airline_code" TEXT,
ADD COLUMN     "airline_name" TEXT,
ADD COLUMN     "arrival_gate" TEXT,
ADD COLUMN     "arrival_terminal" TEXT,
ADD COLUMN     "departure_gate" TEXT,
ADD COLUMN     "departure_terminal" TEXT,
ADD COLUMN     "destination_address" TEXT,
ADD COLUMN     "destination_location_code" TEXT,
ADD COLUMN     "destination_location_type" "TripLocationType",
ADD COLUMN     "destination_name" TEXT,
ADD COLUMN     "flight_number" TEXT,
ADD COLUMN     "flight_status" TEXT,
ADD COLUMN     "origin_address" TEXT,
ADD COLUMN     "origin_location_code" TEXT,
ADD COLUMN     "origin_location_type" "TripLocationType",
ADD COLUMN     "origin_name" TEXT,
ADD COLUMN     "raw_transport_payload" JSONB,
ADD COLUMN     "transport_mode" "TripTransportMode",
ADD COLUMN     "transport_number" TEXT;

-- CreateTable
CREATE TABLE "trip_itinerary_item_assignments" (
    "id" TEXT NOT NULL,
    "trip_itinerary_item_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_itinerary_item_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_itinerary_item_assignments_trip_itinerary_item_id_idx" ON "trip_itinerary_item_assignments"("trip_itinerary_item_id");

-- CreateIndex
CREATE INDEX "trip_itinerary_item_assignments_member_id_idx" ON "trip_itinerary_item_assignments"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_itinerary_item_assignments_trip_itinerary_item_id_memb_key" ON "trip_itinerary_item_assignments"("trip_itinerary_item_id", "member_id");

-- AddForeignKey
ALTER TABLE "trip_itinerary_item_assignments" ADD CONSTRAINT "trip_itinerary_item_assignments_trip_itinerary_item_id_fkey" FOREIGN KEY ("trip_itinerary_item_id") REFERENCES "trip_itinerary_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_itinerary_item_assignments" ADD CONSTRAINT "trip_itinerary_item_assignments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
