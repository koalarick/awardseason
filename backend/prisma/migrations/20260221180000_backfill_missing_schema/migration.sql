CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key" ON "password_reset_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens" ("user_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'password_reset_tokens_user_id_fkey'
    ) THEN
        ALTER TABLE "password_reset_tokens"
            ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "seen_movies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "movie_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seen_movies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seen_movies_user_id_year_movie_id_key" ON "seen_movies" ("user_id", "year", "movie_id");
CREATE INDEX IF NOT EXISTS "seen_movies_user_id_year_idx" ON "seen_movies" ("user_id", "year");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'seen_movies_user_id_fkey'
    ) THEN
        ALTER TABLE "seen_movies"
            ADD CONSTRAINT "seen_movies_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "nominees" ADD COLUMN IF NOT EXISTS "blurb_sentence_1" TEXT;
ALTER TABLE "nominees" ADD COLUMN IF NOT EXISTS "blurb_sentence_2" TEXT;
ALTER TABLE "nominees" ADD COLUMN IF NOT EXISTS "imdb_url" TEXT;

ALTER TABLE "events" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "odds_current" ALTER COLUMN "snapshot_time" TYPE TIMESTAMPTZ;
ALTER TABLE "odds_current" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ;
