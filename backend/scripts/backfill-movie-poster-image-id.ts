import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const normalizeSpecialCharacters = (text: string) =>
  text
    .toLowerCase()
    .replace(/[āáàâä]/g, 'a')
    .replace(/[ēéèêë]/g, 'e')
    .replace(/[īíìîï]/g, 'i')
    .replace(/[ōóòôö]/g, 'o')
    .replace(/[ūúùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .trim();

const filmNameToSlug = (name: string) =>
  normalizeSpecialCharacters(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  const prefix = `${flag}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function findImagesDir(explicitDir?: string): Promise<string> {
  if (explicitDir) {
    const resolved = path.resolve(explicitDir);
    const stats = await fs.stat(resolved);
    if (!stats.isDirectory()) {
      throw new Error(`images dir is not a directory: ${resolved}`);
    }
    return resolved;
  }

  const candidates = [
    path.join(process.cwd(), 'frontend', 'public', 'images'),
    path.join(process.cwd(), '..', 'frontend', 'public', 'images'),
    path.join(__dirname, '..', '..', 'frontend', 'public', 'images'),
    path.join(process.cwd(), 'public', 'images'),
    path.join(__dirname, '..', 'public', 'images'),
  ];

  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    `Could not locate images directory. Tried: ${candidates.join(', ')}`,
  );
}

function getPosterIdsFromFilenames(year: string, filenames: string[]): Set<string> {
  const posterIds = new Set<string>();
  const pattern = new RegExp(`^${year}_movie_(.+)\\.(jpg|jpeg|png|webp)$`, 'i');

  for (const name of filenames) {
    const match = name.match(pattern);
    if (!match || !match[1]) {
      continue;
    }
    posterIds.add(match[1]);
  }

  return posterIds;
}

function getBaseSlug(slug: string): string | null {
  const match = slug.match(/^(.*?)-\d{4}(?:-\d+)?$/);
  if (!match || !match[1]) {
    return null;
  }
  return match[1];
}

async function backfillPosterImageIds() {
  const awardYearArg = getArgValue('--award-year') || getArgValue('--year');
  const awardYear = (awardYearArg || String(new Date().getFullYear())).trim();

  const movieYearArg = getArgValue('--movie-year');
  const movieYear = movieYearArg ? Number.parseInt(movieYearArg, 10) : null;
  const hasMovieYear = Number.isFinite(movieYear ?? Number.NaN);

  const imagesDirArg = getArgValue('--images-dir');
  let imagesDir: string | null = null;
  let posterIds: Set<string> | null = null;
  try {
    imagesDir = await findImagesDir(imagesDirArg);
  } catch (error) {
    if (imagesDirArg) {
      throw error;
    }
    imagesDir = null;
  }

  console.log('Backfilling movie posterImageId from images directory...');
  if (imagesDir) {
    console.log(`- Images directory: ${imagesDir}`);
    console.log(`- Award year (image prefix): ${awardYear}`);
  } else {
    console.log('- Images directory: not found');
    console.log('- Falling back to title-slug inference (no file validation)');
  }
  if (hasMovieYear) {
    console.log(`- Restricting movie matches to release year: ${movieYear}`);
  }

  if (imagesDir) {
    const dirEntries = await fs.readdir(imagesDir, { withFileTypes: true });
    const filenames = dirEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
    posterIds = getPosterIdsFromFilenames(awardYear, filenames);

    if (posterIds.size === 0) {
      throw new Error(`No movie poster images found for year ${awardYear}`);
    }
  }

  const movies = await prisma.movie.findMany({
    where: {
      ...(hasMovieYear && movieYear !== null ? { year: movieYear } : {}),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      year: true,
      posterImageId: true,
    },
  });

  let updated = 0;
  let unchanged = 0;
  let missing = 0;
  let ambiguous = 0;
  let inferred = 0;

  for (const movie of movies) {
    if (movie.posterImageId) {
      unchanged += 1;
      continue;
    }

    const titleSlug = filmNameToSlug(movie.title);

    let posterImageId: string | null = null;

    if (posterIds) {
      const baseSlug = getBaseSlug(movie.slug);
      const candidateIds = [movie.slug, titleSlug, baseSlug]
        .filter((value): value is string => Boolean(value))
        .filter((value, index, self) => self.indexOf(value) === index);

      const matches = candidateIds.filter((candidate) => posterIds?.has(candidate));

      if (matches.length === 0) {
        missing += 1;
        continue;
      }

      if (matches.length > 1) {
        ambiguous += 1;
        continue;
      }

      posterImageId = matches[0];
    } else {
      posterImageId = titleSlug || null;
      if (!posterImageId) {
        missing += 1;
        continue;
      }
      inferred += 1;
    }

    await prisma.movie.update({
      where: { id: movie.id },
      data: { posterImageId },
    });
    updated += 1;
  }

  console.log('\nBackfill complete:');
  console.log(`- Updated: ${updated}`);
  console.log(`- Unchanged (already set): ${unchanged}`);
  console.log(`- Missing poster match: ${missing}`);
  console.log(`- Ambiguous matches: ${ambiguous}`);
  if (!posterIds) {
    console.log(`- Inferred from title slug: ${inferred}`);
  }
}

backfillPosterImageIds()
  .catch((error) => {
    console.error('Error backfilling movie posterImageId:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
