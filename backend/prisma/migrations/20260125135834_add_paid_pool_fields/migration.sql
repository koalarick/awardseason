DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pools'
    ) THEN
        ALTER TABLE "pools"
            ADD COLUMN IF NOT EXISTS "is_paid_pool" BOOLEAN NOT NULL DEFAULT false,
            ADD COLUMN IF NOT EXISTS "entry_amount" DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS "venmo_alias" TEXT;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pool_members'
    ) THEN
        ALTER TABLE "pool_members"
            ADD COLUMN IF NOT EXISTS "has_paid" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
