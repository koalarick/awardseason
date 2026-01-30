// Script to manually run odds snapshot job
import { PrismaClient } from '@prisma/client';
import { OddsService } from '../services/odds.service';

const prisma = new PrismaClient();
const oddsService = new OddsService();

async function runOddsSnapshot() {
  console.log('Running manual odds snapshot...');
  
  // Get current year
  const currentYear = '2026'; // Hardcode for now since we're working with 2026 data
  
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
    await prisma.$disconnect();
    return;
  }
  
  // Transform to match the format expected by createSnapshotForYear
  const formattedCategories = categories.map(category => ({
    id: category.id, // Full ID with year: "best-picture-2026"
    name: category.name,
    nominees: category.nominees.map(nominee => ({
      id: nominee.id,
      name: nominee.name,
      film: nominee.film || undefined,
      song: nominee.song || undefined,
      producers: nominee.producers || undefined,
    })),
  }));
  
  console.log(`Found ${formattedCategories.length} categories for year ${currentYear}`);
  await oddsService.createSnapshotForYear(currentYear, formattedCategories);
  
  await prisma.$disconnect();
  console.log('Odds snapshot complete!');
}

runOddsSnapshot().catch(console.error);
