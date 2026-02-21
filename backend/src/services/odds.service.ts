import { PrismaClient, Prisma } from '@prisma/client';
import { KalshiService } from './kalshi.service';

const prisma = new PrismaClient();
const kalshiService = new KalshiService();
type NomineeSnapshotCandidate = {
  id: string;
  name?: string | null;
  film?: string | null;
  song?: string | null;
  producers?: string | null;
  castingDirector?: string | null;
};
type CategoryWithNominees = {
  id: string;
  nominees: NomineeSnapshotCandidate[];
};
type LatestOddsByCategoryRow = {
  categoryId: string;
  nomineeId: string;
  oddsPercentage: number | null;
};

// Import nominees data - we'll need to copy this structure
// For now, we'll create a function that accepts nominees
export class OddsService {
  async createSnapshotForYear(
    year: string,
    nomineesByCategory: CategoryWithNominees[],
  ): Promise<void> {
    console.log(`Creating odds snapshot for year ${year} at ${new Date().toISOString()}`);

    for (const category of nomineesByCategory) {
      try {
        await kalshiService.createOddsSnapshot(category.id, category.nominees);
        console.log(`Snapshot created for category: ${category.id}`);

        // Extract base category ID (remove year suffix)
        // category.id is like "best-picture-2026", we need "best-picture"
        const baseCategoryId = category.id.includes(`-${year}`)
          ? category.id.replace(`-${year}`, '')
          : category.id.replace(/-\d{4}$/, '');

        // Automatically upgrade predictions where odds have gotten worse (lower percentage)
        // Lower odds = worse odds (less likely to win) but = higher multiplier (more points)
        // Import lazily to avoid circular dependency
        const { PredictionService } = await import('./prediction.service');
        const predictionService = new PredictionService();
        const upgradeResult = await predictionService.upgradeAllPredictionsForCategory(
          baseCategoryId,
          year,
        );
        if (upgradeResult.upgraded > 0) {
          console.log(
            `Upgraded ${upgradeResult.upgraded} out of ${upgradeResult.checked} predictions for category ${baseCategoryId} (odds got worse, giving more potential points)`,
          );
        }
      } catch (error) {
        console.error(`Error creating snapshot for category ${category.id}:`, error);
      }
    }

    console.log('Odds snapshot creation complete');
  }

  async getOddsAtTime(
    categoryId: string,
    nomineeId: string,
    timestamp: Date,
  ): Promise<number | null> {
    // Find the closest snapshot before the timestamp
    const snapshot = await prisma.oddsSnapshot.findFirst({
      where: {
        categoryId,
        nomineeId,
        snapshotTime: {
          lte: timestamp,
        },
      },
      orderBy: {
        snapshotTime: 'desc',
      },
    });

    return snapshot ? snapshot.oddsPercentage : null;
  }

  async getCurrentOdds(categoryId: string, nomineeId: string): Promise<number | null> {
    const current = await prisma.oddsCurrent.findUnique({
      where: {
        categoryId_nomineeId: {
          categoryId,
          nomineeId,
        },
      },
      select: {
        oddsPercentage: true,
      },
    });

    return current?.oddsPercentage ?? null;
  }

  async getCurrentOddsForNomineePairs(
    pairs: Array<{ categoryId: string; nomineeId: string }>,
  ): Promise<Record<string, Record<string, number | null>>> {
    if (pairs.length === 0) return {};

    const valueTuples = pairs.map(
      (pair) => Prisma.sql`(${pair.categoryId}, ${pair.nomineeId})`,
    );
    const rows = await prisma.$queryRaw<LatestOddsByCategoryRow[]>(
      Prisma.sql`
        SELECT v.category_id AS "categoryId",
               v.nominee_id AS "nomineeId",
               c.odds_percentage AS "oddsPercentage"
        FROM (VALUES ${Prisma.join(valueTuples)}) AS v(category_id, nominee_id)
        LEFT JOIN odds_current c
          ON c.category_id = v.category_id
         AND c.nominee_id = v.nominee_id
      `,
    );

    const oddsByCategory: Record<string, Record<string, number | null>> = {};
    for (const row of rows) {
      if (!oddsByCategory[row.categoryId]) {
        oddsByCategory[row.categoryId] = {};
      }
      oddsByCategory[row.categoryId][row.nomineeId] = row.oddsPercentage ?? null;
    }

    return oddsByCategory;
  }
}
