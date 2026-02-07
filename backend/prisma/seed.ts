import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { OddsService } from '../src/services/odds.service';

const prisma = new PrismaClient();
const oddsService = new OddsService();

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

type NomineeSeed = {
  id: string;
  name: string;
  film?: string;
  song?: string;
  producers?: string;
  blurb_sentence_1?: string;
  blurb_sentence_2?: string;
  imdb_url?: string;
  letterboxd_url?: string;
};

type CategorySeed = {
  id: string;
  name: string;
  defaultPoints?: number;
  nominees?: NomineeSeed[];
};

type NomineesByYear = Record<string, CategorySeed[]>;

function getDefaultPointsForCategory(categoryId: string): number {
  if (categoryGroups.major.includes(categoryId)) {
    return 10;
  } else if (categoryGroups.technical.includes(categoryId)) {
    return 3;
  } else if (categoryGroups.filmCategories.includes(categoryId)) {
    return 5;
  }
  // Fallback to 10 if category not found in any group
  return 10;
}

async function main() {
  console.log('Seeding database...');

  // Load nominees data from JSON file
  let nomineesByYear: NomineesByYear = {};
  const possiblePaths = [
    '/app/nominees.json', // Absolute path in container (mounted from root or backend/)
    path.join(process.cwd(), 'nominees.json'), // From current working directory (/app)
    path.join(__dirname, '../nominees.json'), // Relative from prisma/ to backend/nominees.json
    path.join(__dirname, '../../nominees.json'), // Relative from prisma/ to root
  ];

  console.log('Looking for nominees.json...');
  console.log('Current working directory:', process.cwd());
  console.log('__dirname:', __dirname);
  console.log('Possible paths:', possiblePaths);

  for (const jsonPath of possiblePaths) {
    try {
      const exists = fs.existsSync(jsonPath);
      console.log(`Checking: ${jsonPath} - exists: ${exists}`);
      if (exists) {
        const fileContent = fs.readFileSync(jsonPath, 'utf8');
        console.log(`File size: ${fileContent.length} bytes`);
        nomineesByYear = JSON.parse(fileContent) as NomineesByYear;
        console.log(`Successfully loaded nominees.json from: ${jsonPath}`);
        break;
      }
    } catch (error) {
      console.error(`Error loading ${jsonPath}:`, error.message);
      continue;
    }
  }

  if (Object.keys(nomineesByYear).length === 0) {
    console.error('Failed to load nominees.json from any path:', possiblePaths);
    console.error('Make sure nominees.json exists and is mounted correctly');
    return; // Exit early if we can't load the data
  }

  console.log('Loaded nomineesByYear. Available years:', Object.keys(nomineesByYear));

  if (nomineesByYear['2026']) {
    console.log('2026 data type:', typeof nomineesByYear['2026']);
    console.log('2026 data isArray:', Array.isArray(nomineesByYear['2026']));
    console.log('2026 data length:', nomineesByYear['2026'].length);
  } else {
    console.log('2026 data not found in nomineesByYear');
    return; // Exit early if no 2026 data
  }

  // Create superuser (you can change the email/password)
  const superuserEmail = process.env.SUPERUSER_EMAIL || 'admin@example.com';
  const superuserPassword = process.env.SUPERUSER_PASSWORD || 'admin123';

  const passwordHash = await bcrypt.hash(superuserPassword, 10);

  const superuser = await prisma.user.upsert({
    where: { email: superuserEmail },
    update: {},
    create: {
      email: superuserEmail,
      passwordHash,
      role: UserRole.SUPERUSER,
    },
  });

  console.log('Created superuser:', superuser.email);

  // Create public global pool for 2026 Oscars
  const currentYear = '2026';
  const ceremonyDate = new Date('2026-03-08T20:00:00Z'); // Oscars ceremony date (adjust as needed)

  // Check if global pool already exists
  let globalPool = await prisma.pool.findFirst({
    where: {
      name: 'Global Oscars Pool 2026',
      year: currentYear,
    },
  });

  if (!globalPool) {
    globalPool = await prisma.pool.create({
      data: {
        name: 'Global Oscars Pool 2026',
        year: currentYear,
        ceremonyDate,
        isPublic: true,
        passwordHash: null, // No password for public pool
        ownerId: superuser.id, // Owned by superuser
      },
    });

    // Create default pool settings
    await prisma.poolSettings.create({
      data: {
        poolId: globalPool.id,
        categoryPoints: {},
        oddsMultiplierEnabled: true,
        oddsMultiplierFormula: 'log',
      },
    });

    // Add superuser as a member of the global pool
    try {
      const existingMember = await prisma.poolMember.findUnique({
        where: {
          poolId_userId: {
            poolId: globalPool.id,
            userId: superuser.id,
          },
        },
      });

      if (!existingMember) {
        await prisma.poolMember.create({
          data: {
            poolId: globalPool.id,
            userId: superuser.id,
          },
        });
      }
    } catch (error) {
      console.error('Failed to add superuser to global pool:', error);
    }

    console.log('Created global public pool:', globalPool.name);
  } else {
    console.log('Global public pool already exists:', globalPool.name);
  }

  // Seed categories and nominees for 2026
  const year = '2026';
  const yearKey = year;
  const yearNumberKey = String(parseInt(year, 10));
  console.log('nomineesByYear object:', {
    keys: Object.keys(nomineesByYear),
    has2026: !!nomineesByYear[yearKey],
    has2026Number: !!nomineesByYear[yearNumberKey],
    type2026: typeof nomineesByYear[yearKey],
    isArray2026: Array.isArray(nomineesByYear[yearKey]),
    length2026: nomineesByYear[yearKey]?.length,
  });

  const yearData = nomineesByYear[yearKey] || nomineesByYear[yearNumberKey];

  if (yearData && Array.isArray(yearData)) {
    console.log(`Seeding ${yearData.length} categories for year ${year}...`);

    // Clear existing nominees and categories for this year first (in case of schema changes)
    console.log('Clearing existing data for year', year);
    await prisma.nominee.deleteMany({
      where: {
        category: {
          year: year,
        },
      },
    });
    await prisma.category.deleteMany({
      where: {
        year: year,
      },
    });

    for (const categoryData of yearData) {
      // Create composite ID: categoryId-year
      const categoryId = `${categoryData.id}-${year}`;

      // Determine default points based on category type
      // Use explicit defaultPoints from JSON if provided, otherwise use category type defaults
      const defaultPoints =
        categoryData.defaultPoints !== undefined
          ? categoryData.defaultPoints
          : getDefaultPointsForCategory(categoryData.id);

      // Upsert category
      const category = await prisma.category.upsert({
        where: {
          id: categoryId,
        },
        update: {
          name: categoryData.name,
          defaultPoints: defaultPoints,
        },
        create: {
          id: categoryId,
          name: categoryData.name,
          year: year,
          defaultPoints: defaultPoints,
        },
      });

      // Upsert nominees for this category
      if (categoryData.nominees && Array.isArray(categoryData.nominees)) {
        for (const nomineeData of categoryData.nominees) {
          await prisma.nominee.upsert({
            where: {
              categoryId_id: {
                categoryId: category.id,
                id: nomineeData.id,
              },
            },
            update: {
              name: nomineeData.name,
              film: nomineeData.film || null,
              song: nomineeData.song || null,
              producers: nomineeData.producers || null,
              blurb_sentence_1: nomineeData.blurb_sentence_1 || null,
              blurb_sentence_2: nomineeData.blurb_sentence_2 || null,
              imdb_url: nomineeData.imdb_url || null,
              letterboxd_url: nomineeData.letterboxd_url || null,
            },
            create: {
              id: nomineeData.id,
              categoryId: category.id,
              name: nomineeData.name,
              film: nomineeData.film || null,
              song: nomineeData.song || null,
              producers: nomineeData.producers || null,
              blurb_sentence_1: nomineeData.blurb_sentence_1 || null,
              blurb_sentence_2: nomineeData.blurb_sentence_2 || null,
              imdb_url: nomineeData.imdb_url || null,
              letterboxd_url: nomineeData.letterboxd_url || null,
            },
          });
        }
        console.log(`  - Seeded ${categoryData.nominees.length} nominees for ${category.name}`);
      }
    }

    console.log(`Categories and nominees seeded for year ${year}`);

    // Create initial odds snapshots after seeding categories and nominees
    console.log('Creating initial odds snapshots...');
    try {
      // Fetch the seeded categories with nominees to create snapshots
      const categoriesWithNominees = await prisma.category.findMany({
        where: { year },
        include: {
          nominees: {
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });

      const formattedCategories = categoriesWithNominees.map((category) => ({
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

      await oddsService.createSnapshotForYear(year, formattedCategories);
      console.log('Odds snapshots created successfully');
    } catch (error) {
      console.error(
        'Error creating odds snapshots (this is okay if Kalshi API is not configured):',
        error.message,
      );
      console.log('Odds snapshots will be created automatically by the hourly cron job');
    }
  } else {
    console.log(`No nominees data found for year ${year}`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
