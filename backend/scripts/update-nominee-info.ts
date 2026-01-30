import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

type NomineeRecord = {
  id: string;
  blurb_sentence_1?: string;
  blurb_sentence_2?: string;
  imdb_url?: string;
  letterboxd_url?: string;
};

type CategoryRecord = {
  id: string;
  nominees: NomineeRecord[];
};

type NomineesByYear = Record<string, CategoryRecord[]>;

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  const prefix = `${flag}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function loadNominees(possiblePaths: string[]): Promise<{ data: NomineesByYear; source: string } | null> {
  for (const jsonPath of possiblePaths) {
    try {
      await fs.access(jsonPath);
      const fileContent = await fs.readFile(jsonPath, 'utf8');
      const parsed = JSON.parse(fileContent) as NomineesByYear;
      return { data: parsed, source: jsonPath };
    } catch {
      continue;
    }
  }
  return null;
}

async function updateNomineeInfo() {
  console.log('Updating nominee info from nominees.json...');

  // Load nominees.json
  const possiblePaths = [
    path.join(process.cwd(), 'nominees.json'),
    path.join(process.cwd(), '..', 'nominees.json'),
    path.join(__dirname, '..', '..', 'nominees.json'),
  ];

  const loadResult = await loadNominees(possiblePaths);
  if (!loadResult) {
    throw new Error('Could not load nominees.json');
  }
  const { data: nomineesByYear, source } = loadResult;
  console.log(`Loaded nominees.json from: ${source}`);

  const yearArg = getArgValue('--year');
  const year = (yearArg || new Date().getFullYear().toString()).trim();
  const yearData = nomineesByYear[year] || nomineesByYear[parseInt(year, 10)];

  if (!yearData || !Array.isArray(yearData)) {
    throw new Error(`No data found for year ${year}`);
  }

  let updated = 0;
  let skipped = 0;

  for (const categoryData of yearData) {
    const categoryId = `${categoryData.id}-${year}`;

    // Find the category
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      console.log(`Category not found: ${categoryId}`);
      continue;
    }

    // Update each nominee
    for (const nomineeData of categoryData.nominees) {
      if (!nomineeData.blurb_sentence_1 || !nomineeData.blurb_sentence_2 || !nomineeData.imdb_url) {
        skipped++;
        continue;
      }

      try {
        await prisma.nominee.update({
          where: {
            categoryId_id: {
              categoryId: category.id,
              id: nomineeData.id,
            },
          },
          data: {
            blurb_sentence_1: nomineeData.blurb_sentence_1,
            blurb_sentence_2: nomineeData.blurb_sentence_2,
            imdb_url: nomineeData.imdb_url,
            letterboxd_url: nomineeData.letterboxd_url && nomineeData.letterboxd_url.trim()
              ? nomineeData.letterboxd_url
              : null,
          },
        });
        updated++;
      } catch (error: any) {
        console.log(`Failed to update ${categoryId}/${nomineeData.id}: ${error.message}`);
        skipped++;
      }
    }
  }

  console.log(`\nUpdate complete:`);
  console.log(`  - Updated: ${updated} nominees`);
  console.log(`  - Skipped: ${skipped} nominees`);
}

updateNomineeInfo()
  .catch((error) => {
    console.error('Error updating nominee info:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
