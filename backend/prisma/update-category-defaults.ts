import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Category grouping configuration for default points
const categoryGroups = {
  major: [
    'best-picture',
    'directing',
    'writing-original',
    'writing-adapted',
    'actor-leading',
    'actress-leading',
    'actor-supporting',
    'actress-supporting',
  ],
  technical: [
    'cinematography',
    'film-editing',
    'sound',
    'visual-effects',
    'production-design',
    'costume-design',
    'makeup-hairstyling',
    'music-score',
    'music-song',
    'casting',
  ],
  filmCategories: [
    'international-feature',
    'animated-feature',
    'documentary-feature',
    'animated-short',
    'documentary-short',
    'live-action-short',
  ],
};

function getDefaultPointsForCategory(categoryId: string): number {
  // Remove year suffix if present (e.g., "best-picture-2026" -> "best-picture")
  const baseCategoryId = categoryId.replace(/-\d{4}$/, '');

  if (categoryGroups.major.includes(baseCategoryId)) {
    return 10;
  } else if (categoryGroups.technical.includes(baseCategoryId)) {
    return 3;
  } else if (categoryGroups.filmCategories.includes(baseCategoryId)) {
    return 5;
  }
  // Fallback to 10 if category not found in any group
  return 10;
}

async function main() {
  console.log('Updating category default points...');

  // Get all categories
  const categories = await prisma.category.findMany();

  console.log(`Found ${categories.length} categories to update`);

  let updatedCount = 0;
  for (const category of categories) {
    const newDefaultPoints = getDefaultPointsForCategory(category.id);

    if (category.defaultPoints !== newDefaultPoints) {
      await prisma.category.update({
        where: { id: category.id },
        data: { defaultPoints: newDefaultPoints },
      });
      console.log(
        `Updated ${category.name} (${category.id}): ${category.defaultPoints} -> ${newDefaultPoints}`,
      );
      updatedCount++;
    }
  }

  console.log(`\nUpdate complete! Updated ${updatedCount} categories.`);
}

main()
  .catch((e) => {
    console.error('Error updating categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
