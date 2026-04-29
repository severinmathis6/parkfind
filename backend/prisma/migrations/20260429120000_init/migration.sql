-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "parking_type" AS ENUM ('street', 'garage', 'private');

-- CreateTable
CREATE TABLE "parkings" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "parking_type" "parking_type" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "total_spots" INTEGER NOT NULL,
    "available_spots" INTEGER NOT NULL,
    "price_per_hour" DECIMAL(10,2) NOT NULL,
    "is_ev_charging" BOOLEAN NOT NULL DEFAULT false,
    "max_height" DOUBLE PRECISION,
    "opening_hours" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parkings_pkey" PRIMARY KEY ("id")
);

-- PostGIS GEOGRAPHY column (auto-filled by trigger from latitude/longitude)
ALTER TABLE "parkings" ADD COLUMN "location" GEOGRAPHY(Point, 4326);

CREATE OR REPLACE FUNCTION update_parking_location() RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER parkings_location_trigger
BEFORE INSERT OR UPDATE ON "parkings"
FOR EACH ROW EXECUTE FUNCTION update_parking_location();

-- GIST index for spatial queries (ST_DWithin, etc.)
CREATE INDEX "parkings_location_gix" ON "parkings" USING GIST (location);

-- B-tree indexes for filter columns
CREATE INDEX "parkings_is_ev_charging_idx" ON "parkings"("is_ev_charging");
CREATE INDEX "parkings_parking_type_idx" ON "parkings"("parking_type");
