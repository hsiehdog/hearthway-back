-- CreateEnum
CREATE TYPE "TripItineraryItemStatus" AS ENUM ('PROPOSED', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "trip_itinerary_items" ADD COLUMN     "status" "TripItineraryItemStatus" NOT NULL DEFAULT 'PROPOSED';
