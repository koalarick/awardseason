CREATE INDEX IF NOT EXISTS "odds_snapshots_category_nominee_snapshot_time_idx"
ON "odds_snapshots" ("category_id", "nominee_id", "snapshot_time" DESC);
