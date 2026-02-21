import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const MOVIE_RELEASE_YEAR = 2025;
const personCategoryPattern = /(actor|actress|directing)/i;

type NomineeSeed = {
  id: string;
  name: string;
  film?: string;
  song?: string;
  imdb_url?: string;
  letterboxd_url?: string;
};

type CategorySeed = {
  id: string;
  name: string;
  nominees?: NomineeSeed[];
};

type NomineesByYear = Record<string, CategorySeed[]>;

type MovieSeed = {
  slug: string;
  title: string;
  year: number;
  imdbId: string | null;
  letterboxdUrl: string | null;
  tmdbId: number | null;
  wikidataId: string | null;
  posterPath: string | null;
  posterImageId: string | null;
};

const isPersonCategory = (categoryId: string) => personCategoryPattern.test(categoryId);

function normalizeSpecialCharacters(text: string): string {
  return text
    .toLowerCase()
    .replace(/[āáàâä]/g, 'a')
    .replace(/[ēéèêë]/g, 'e')
    .replace(/[īíìîï]/g, 'i')
    .replace(/[ōóòôö]/g, 'o')
    .replace(/[ūúùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .trim();
}

function filmNameToSlug(name: string): string {
  return normalizeSpecialCharacters(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractImdbId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/tt\\d+/i);
  return match ? match[0] : null;
}

function getMovieTitleFromNominee(nominee: NomineeSeed, categoryId: string): string | null {
  if (isPersonCategory(categoryId)) {
    return nominee.film ?? null;
  }

  if (nominee.film) {
    return nominee.film;
  }

  if (categoryId === 'music-song' && nominee.song) {
    const match = nominee.song.match(/from\\s+([^;]+)/i);
    return match?.[1]?.trim() || null;
  }

  if (nominee.name) {
    return nominee.name;
  }

  return null;
}

function loadNominees(): NomineesByYear {
  const possiblePaths = [
    '/app/nominees.json',
    path.join(process.cwd(), 'nominees.json'),
    path.join(__dirname, '../nominees.json'),
    path.join(__dirname, '../../nominees.json'),
  ];

  for (const jsonPath of possiblePaths) {
    if (fs.existsSync(jsonPath)) {
      const fileContent = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(fileContent) as NomineesByYear;
    }
  }

  throw new Error(`Failed to load nominees.json from: ${possiblePaths.join(', ')}`);
}

async function main() {
  console.log('Seeding movies only...');
  const nomineesByYear = loadNominees();
  const yearData = nomineesByYear['2026'];
  if (!Array.isArray(yearData)) {
    throw new Error('No nominees found for year 2026');
  }

  const moviesBySlug = new Map<string, MovieSeed>();

  const upsertMovieSeed = (
    title: string,
    imdbId: string | null,
    letterboxdUrl: string | null,
  ) => {
    const slug = filmNameToSlug(title);
    const existing = moviesBySlug.get(slug);

    if (!existing) {
      moviesBySlug.set(slug, {
        slug,
        title,
        year: MOVIE_RELEASE_YEAR,
        imdbId,
        letterboxdUrl,
        tmdbId: null,
        wikidataId: null,
        posterPath: null,
        posterImageId: null,
      });
      return;
    }

    if (!existing.imdbId && imdbId) existing.imdbId = imdbId;
    if (!existing.letterboxdUrl && letterboxdUrl) existing.letterboxdUrl = letterboxdUrl;
  };

  for (const categoryData of yearData) {
    const categoryIsPerson = isPersonCategory(categoryData.id);
    if (!categoryData.nominees) continue;

    for (const nomineeData of categoryData.nominees) {
      const title = getMovieTitleFromNominee(nomineeData, categoryData.id);
      if (!title) continue;
      const imdbId = categoryIsPerson ? null : extractImdbId(nomineeData.imdb_url);
      const letterboxdUrl = categoryIsPerson ? null : nomineeData.letterboxd_url || null;
      upsertMovieSeed(title, imdbId, letterboxdUrl);
    }
  }

  console.log(`Upserting ${moviesBySlug.size} movies...`);
  for (const movie of moviesBySlug.values()) {
    await prisma.movie.upsert({
      where: { slug: movie.slug },
      update: {
        title: movie.title,
        year: movie.year,
        imdbId: movie.imdbId ?? undefined,
        letterboxdUrl: movie.letterboxdUrl ?? undefined,
      },
      create: {
        slug: movie.slug,
        title: movie.title,
        year: movie.year,
        imdbId: movie.imdbId,
        letterboxdUrl: movie.letterboxdUrl,
        tmdbId: movie.tmdbId,
        wikidataId: movie.wikidataId,
        posterPath: movie.posterPath,
        posterImageId: movie.posterImageId,
      },
    });
  }

  console.log('Movie seed complete.');
}

main()
  .catch((error) => {
    console.error('Error seeding movies:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
