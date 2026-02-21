CREATE TABLE IF NOT EXISTS "odds_current" (
    "category_id" TEXT NOT NULL,
    "nominee_id" TEXT NOT NULL,
    "odds_percentage" DOUBLE PRECISION NOT NULL,
    "snapshot_time" TIMESTAMPTZ NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "odds_current_pkey" PRIMARY KEY ("category_id", "nominee_id")
);

INSERT INTO "odds_current" ("category_id", "nominee_id", "odds_percentage", "snapshot_time")
SELECT DISTINCT ON ("category_id", "nominee_id")
  "category_id",
  "nominee_id",
  "odds_percentage",
  "snapshot_time"
FROM "odds_snapshots"
ORDER BY "category_id", "nominee_id", "snapshot_time" DESC
ON CONFLICT ("category_id", "nominee_id")
DO UPDATE SET
  "odds_percentage" = EXCLUDED."odds_percentage",
  "snapshot_time" = EXCLUDED."snapshot_time",
  "updated_at" = NOW()
WHERE "odds_current"."snapshot_time" <= EXCLUDED."snapshot_time";
