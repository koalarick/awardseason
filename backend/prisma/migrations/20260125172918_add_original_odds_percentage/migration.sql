-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPERUSER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "oauth_provider" TEXT,
    "oauth_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "ceremony_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_members" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "submission_name" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pool_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "nominee_id" TEXT NOT NULL,
    "odds_percentage" DOUBLE PRECISION,
    "original_odds_percentage" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_snapshots" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "nominee_id" TEXT NOT NULL,
    "nominee_name" TEXT NOT NULL,
    "nominee_film" TEXT,
    "odds_percentage" DOUBLE PRECISION NOT NULL,
    "snapshot_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actual_winners" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "nominee_id" TEXT NOT NULL,
    "entered_by" TEXT,
    "is_auto_detected" BOOLEAN NOT NULL DEFAULT false,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actual_winners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_settings" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "category_points" JSONB NOT NULL,
    "odds_multiplier_enabled" BOOLEAN NOT NULL DEFAULT true,
    "odds_multiplier_formula" TEXT NOT NULL DEFAULT 'linear',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pool_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "default_points" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nominees" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "film" TEXT,
    "song" TEXT,
    "producers" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nominees_pkey" PRIMARY KEY ("category_id","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pool_members_pool_id_user_id_key" ON "pool_members"("pool_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_pool_id_user_id_category_id_key" ON "predictions"("pool_id", "user_id", "category_id");

-- CreateIndex
CREATE INDEX "odds_snapshots_category_id_snapshot_time_idx" ON "odds_snapshots"("category_id", "snapshot_time");

-- CreateIndex
CREATE INDEX "odds_snapshots_snapshot_time_idx" ON "odds_snapshots"("snapshot_time");

-- CreateIndex
CREATE UNIQUE INDEX "actual_winners_pool_id_category_id_key" ON "actual_winners"("pool_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "pool_settings_pool_id_key" ON "pool_settings"("pool_id");

-- CreateIndex
CREATE INDEX "categories_year_idx" ON "categories"("year");

-- CreateIndex
CREATE INDEX "nominees_category_id_idx" ON "nominees"("category_id");

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actual_winners" ADD CONSTRAINT "actual_winners_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actual_winners" ADD CONSTRAINT "actual_winners_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_settings" ADD CONSTRAINT "pool_settings_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominees" ADD CONSTRAINT "nominees_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
