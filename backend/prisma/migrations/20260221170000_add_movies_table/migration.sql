CREATE TABLE IF NOT EXISTS "movies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "imdb_id" TEXT NULL,
    "letterboxd_url" TEXT NULL,
    "tmdb_id" INTEGER NULL,
    "wikidata_id" TEXT NULL,
    "poster_path" TEXT NULL,
    "poster_image_id" TEXT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "movies_slug_key" ON "movies" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "movies_imdb_id_key" ON "movies" ("imdb_id");
CREATE INDEX IF NOT EXISTS "movies_year_idx" ON "movies" ("year");
