-- AlterTable
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pool_settings' 
        AND column_name = 'payout_structure'
    ) THEN
        ALTER TABLE "pool_settings" ADD COLUMN "payout_structure" JSONB;
    END IF;
END $$;
