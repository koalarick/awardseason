CREATE TABLE IF NOT EXISTS "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "user_id" TEXT NULL,
    "pool_id" TEXT NULL,
    "request_id" TEXT NULL,
    "ip" TEXT NULL,
    "user_agent" TEXT NULL,
    "device_type" TEXT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS "events_created_at_idx" ON "events" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "events_event_name_idx" ON "events" ("event_name");
CREATE INDEX IF NOT EXISTS "events_user_id_idx" ON "events" ("user_id");
CREATE INDEX IF NOT EXISTS "events_pool_id_idx" ON "events" ("pool_id");
CREATE INDEX IF NOT EXISTS "events_request_id_idx" ON "events" ("request_id");
