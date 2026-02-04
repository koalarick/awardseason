import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { OddsService } from '../services/odds.service';

const prisma = new PrismaClient();
const oddsService = new OddsService();

// Run every 10 minutes
export function startOddsSnapshotJob() {
  cron.schedule('*/10 * * * *', async () => {
    console.log('Starting odds snapshot job...');

    // Get current year
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

    // Transform to match the format expected by createSnapshotForYear
    // The category ID needs to include the year suffix for createOddsSnapshot
    const formattedCategories = categories.map((category) => ({
      id: category.id, // Full ID with year: "best-picture-2026"
      name: category.name,
      nominees: category.nominees.map((nominee) => ({
        id: nominee.id,
        name: nominee.name,
        film: nominee.film || undefined,
        song: nominee.song || undefined,
        producers: nominee.producers || undefined,
      })),
    }));

    console.log(`Found ${formattedCategories.length} categories for year ${currentYear}`);
    await oddsService.createSnapshotForYear(currentYear, formattedCategories);
  });

  console.log('Odds snapshot cron job scheduled (runs every 10 minutes)');
}
