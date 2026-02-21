-- AlterTable
ALTER TABLE "pools" ADD COLUMN "is_paid_pool" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "entry_amount" DOUBLE PRECISION,
ADD COLUMN "venmo_alias" TEXT;

-- AlterTable
ALTER TABLE "pool_members" ADD COLUMN "has_paid" BOOLEAN NOT NULL DEFAULT false;
