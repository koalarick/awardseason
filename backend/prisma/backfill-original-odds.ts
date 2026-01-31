// Script to backfill original_odds_percentage for existing predictions
// Run this after:
// 1. Schema has been updated (prisma db push)
// 2. Prisma Client has been regenerated (prisma generate)
// Then run: npx tsx prisma/backfill-original-odds.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Backfilling original_odds_percentage for existing predictions...');

  // First, check if the column exists by trying to query all predictions
  // We'll filter in memory since Prisma Client might not be regenerated yet
  const allPredictions = await prisma.prediction.findMany({
    select: {
      id: true,
      poolId: true,
      userId: true,
      categoryId: true,
      oddsPercentage: true,
    },
  });

  console.log(`Found ${allPredictions.length} total predictions`);

  // Filter predictions that need updating (where originalOddsPercentage would be null)
  // We'll update all predictions that have oddsPercentage set
  const predictionsToUpdate = allPredictions.filter(
    (p) => p.oddsPercentage !== null && p.oddsPercentage !== undefined,
  );

  console.log(`Found ${predictionsToUpdate.length} predictions to update`);

  console.log(`Found ${predictionsToUpdate.length} predictions to update`);

  if (predictionsToUpdate.length === 0) {
    console.log('No predictions need updating. Exiting.');
    return;
  }

  // Update each prediction using raw SQL to avoid Prisma Client issues
  let updatedCount = 0;
  for (const prediction of predictionsToUpdate) {
    try {
      // Use raw SQL to update since Prisma Client might not have the field yet
      await prisma.$executeRaw`
        UPDATE predictions 
        SET original_odds_percentage = ${prediction.oddsPercentage}
        WHERE pool_id = ${prediction.poolId}
          AND user_id = ${prediction.userId}
          AND category_id = ${prediction.categoryId}
          AND (original_odds_percentage IS NULL OR original_odds_percentage != ${prediction.oddsPercentage})
      `;
      updatedCount++;
    } catch (error: any) {
      console.error(`Error updating prediction ${prediction.id}:`, error.message);
    }
  }

  console.log(`Successfully updated ${updatedCount} predictions`);
  console.log('Backfill complete!');
}

main()
  .catch((e) => {
    console.error('Error backfilling:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
