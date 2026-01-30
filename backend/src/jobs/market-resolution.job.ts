import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { KalshiService } from '../services/kalshi.service';
import { ScoringService } from '../services/scoring.service';

const prisma = new PrismaClient();
const kalshiService = new KalshiService();
const scoringService = new ScoringService();

// Category to Kalshi event mapping (same as in kalshi.service.ts)
const categoryToKalshiEvent: Record<string, string> = {
  'best-picture': 'KXOSCARPIC-26',
  'directing': 'KXOSCARDIR-26',
  'actor-leading': 'KXOSCARACTO-26',
  'actress-leading': 'KXOSCARACTR-26',
  'actor-supporting': 'KXOSCARSUPACTO-26',
  'actress-supporting': 'KXOSCARSUPACTR-26',
  'writing-original': 'KXOSCARSPLAY-26',
  'writing-adapted': 'KXOSCARASPLAY-26',
  'cinematography': 'KXOSCARCINE-26',
  'film-editing': 'KXOSCAREDIT-26',
  'music-score': 'KXOSCARSCORE-26',
  'music-song': 'KXOSCARSONG-26',
  'sound': 'KXOSCARSOUND-26',
  'production-design': 'KXOSCARPROD-26',
  'visual-effects': 'KXOSCARVIS-26',
  'costume-design': 'KXOSCARCOSTUME-26',
  'makeup-hairstyling': 'KXOSCARMAH-26',
  'international-feature': 'KXOSCARINTLFILM-26',
  'animated-feature': 'KXOSCARANIMATED-26b',
  'documentary-feature': 'KXOSCARDOCU-26',
  'documentary-short': 'KXOSCARDSFILM-26',
  'animated-short': 'KXOSCARAS-26b',
  'live-action-short': 'KXOSCARLASF-26',
  'casting': 'KXOSCARCasting-26',
};

async function matchWinnerToNominee(
  winnerName: string,
  categoryId: string,
  nominees: any[]
): Promise<string | null> {
  const searchName = winnerName.toLowerCase().trim();

  for (const nominee of nominees) {
    const nomineeName = (nominee.name || '').toLowerCase().trim();
    const nomineeFilm = (nominee.film || '').toLowerCase().trim();

    // Exact match
    if (nomineeName === searchName || nomineeFilm === searchName) {
      return nominee.id;
    }

    // Partial match
    if (
      nomineeName.includes(searchName) ||
      searchName.includes(nomineeName) ||
      (nomineeFilm && (nomineeFilm.includes(searchName) || searchName.includes(nomineeFilm)))
    ) {
      return nominee.id;
    }
  }

  return null;
}

export function startMarketResolutionJob() {
  // Run every 5 minutes during ceremony day
  // In production, you might want to make this configurable or only run on ceremony day
  cron.schedule('*/5 * * * *', async () => {
    console.log('Checking Kalshi markets for resolution...');

    try {
      const currentYear = new Date().getFullYear().toString();

      // Fetch categories with nominees from database
      const categories = await prisma.category.findMany({
        where: { year: currentYear },
        include: {
          nominees: {
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });

      if (!categories || categories.length === 0) {
        console.log(`No nominees data found for year ${currentYear} in database`);
        return;
      }

      // Get all active pools for current year
      const pools = await prisma.pool.findMany({
        where: {
          year: currentYear,
        },
        include: {
          actualWinners: true,
        },
      });

      // Check each category for resolution
      for (const category of categories) {
        // Extract base category ID (remove year suffix) for Kalshi lookup
        // category.id is like "best-picture-2026", but Kalshi needs "best-picture"
        const baseCategoryId = category.id.includes('-2026') 
          ? category.id.replace('-2026', '') 
          : category.id.replace(/-\d{4}$/, ''); // Remove any 4-digit year suffix
        
        const markets = await kalshiService.getCategoryMarkets(baseCategoryId);

        if (!markets || !markets.markets) {
          continue;
        }

        // Check each market for resolution
        for (const market of markets.markets) {
          if (market.status === 'resolved' || market.status === 'closed') {
            // Check if YES outcome won
            if (market.yes_price === 100 || market.last_price === 100) {
              const winnerName =
                market.yes_sub_title || market.subtitle || market.title || '';

              // Match winner to nominee
              const nomineeId = await matchWinnerToNominee(
                winnerName,
                category.id, // Use full category ID with year for database
                category.nominees.map(n => ({
                  id: n.id,
                  name: n.name,
                  film: n.film || undefined,
                }))
              );

              if (nomineeId) {
                // Update all pools for this category
                for (const pool of pools) {
                  // Check if winner already set (don't overwrite manual entries)
                  const existingWinner = pool.actualWinners.find(
                    (w) => w.categoryId === category.id
                  );

                  if (!existingWinner || existingWinner.isAutoDetected) {
                    // Update or create winner entry
                    await prisma.actualWinner.upsert({
                      where: {
                        poolId_categoryId: {
                          poolId: pool.id,
                          categoryId: category.id, // Use full category ID with year
                        },
                      },
                      update: {
                        nomineeId,
                        isAutoDetected: true,
                        updatedAt: new Date(),
                      },
                      create: {
                        poolId: pool.id,
                        categoryId: category.id, // Use full category ID with year
                        nomineeId,
                        enteredBy: pool.ownerId,
                        isAutoDetected: true,
                      },
                    });

                    console.log(
                      `Auto-detected winner for pool ${pool.id}, category ${category.id}: ${nomineeId}`
                    );
                  }
                }
              }
            }
          }
        }
      }

      console.log('Market resolution check complete');
    } catch (error) {
      console.error('Error checking market resolution:', error);
    }
  });

  console.log('Market resolution cron job scheduled (runs every 5 minutes)');
}
