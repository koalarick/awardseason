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
type LatestOddsRow = {
  nomineeId: string;
  oddsPercentage: number | null;
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
    // Get the most recent snapshot
    const snapshot = await prisma.oddsSnapshot.findFirst({
      where: {
        categoryId,
        nomineeId,
      },
      orderBy: {
        snapshotTime: 'desc',
      },
      select: {
        oddsPercentage: true,
      },
    });

    return snapshot?.oddsPercentage ?? null;
  }

  async getCurrentOddsForCategory(categoryId: string): Promise<Record<string, number | null>> {
    const rows = await prisma.$queryRaw<LatestOddsRow[]>`
      SELECT DISTINCT ON ("nominee_id")
        "nominee_id" AS "nomineeId",
        "odds_percentage" AS "oddsPercentage"
      FROM "odds_snapshots"
      WHERE "category_id" = ${categoryId}
      ORDER BY "nominee_id", "snapshot_time" DESC
    `;

    const oddsByNominee: Record<string, number | null> = {};
    for (const row of rows) {
      oddsByNominee[row.nomineeId] = row.oddsPercentage ?? null;
    }

    return oddsByNominee;
  }

  async getCurrentOddsForCategories(
    categoryIds: string[],
  ): Promise<Record<string, Record<string, number | null>>> {
    if (categoryIds.length === 0) return {};

    const rows = await prisma.$queryRaw<LatestOddsByCategoryRow[]>(
      Prisma.sql`
        SELECT DISTINCT ON ("category_id", "nominee_id")
          "category_id" AS "categoryId",
          "nominee_id" AS "nomineeId",
          "odds_percentage" AS "oddsPercentage"
        FROM "odds_snapshots"
        WHERE "category_id" IN (${Prisma.join(categoryIds)})
        ORDER BY "category_id", "nominee_id", "snapshot_time" DESC
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
