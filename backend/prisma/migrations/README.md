# Prisma Migrations

This directory contains database migrations for the Academy Awards Pool application.

## Migration History

### Migration Order (by timestamp)

1. **20260125135834_add_paid_pool_fields** (Jan 25, 2025 13:58:34)
   - Adds paid pool functionality
   - Adds `is_paid_pool`, `entry_amount`, `venmo_alias` columns to `pools` table
   - Adds `has_paid` column to `pool_members` table

2. **20260125172918_add_original_odds_percentage** (Jan 25, 2025 17:29:18)
   - **NOTE: This is the INITIAL migration that creates all database tables**
   - Creates all core tables: users, pools, pool_members, predictions, odds_snapshots, actual_winners, pool_settings, categories, nominees
   - Creates UserRole enum
   - Creates all indexes and foreign keys
   - Adds `original_odds_percentage` column to `predictions` table

3. **20260126000000_add_payout_structure** (Jan 26, 2025 00:00:00)
   - Adds `payout_structure` JSONB column to `pool_settings` table
   - Uses manual timestamp (should ideally use Prisma-generated timestamp)

## Important Notes

- The migration `20260125172918_add_original_odds_percentage` is named for a specific feature but actually contains the initial schema creation. This is the base migration.
- Migration timestamps may appear out of logical order, but they are ordered correctly by Prisma based on their directory names.
- The standalone SQL file `add_original_odds_percentage.sql` has been removed as it was redundant with the migration above.
- All migrations should be run in order when setting up a new database.

## Running Migrations

```bash
# Development: Create and apply migration
npx prisma migrate dev

# Production: Apply pending migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```
