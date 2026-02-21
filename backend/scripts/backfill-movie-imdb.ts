import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type NomineeRecord = {
  name: string;
  film: string | null;
  song: string | null;
  imdb_url: string | null;
  categoryId: string;
};

type MovieRecord = {
  id: string;
  title: string;
  year: number;
  imdbId: string | null;
};

const personCategoryPattern = /(actor|actress|directing)/i;

const stripYearSuffix = (categoryId: string) => categoryId.replace(/-\d{4}$/, '');

const isPersonCategory = (categoryId: string) => personCategoryPattern.test(categoryId);

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

const extractImdbId = (url?: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/tt\d+/i);
  return match ? match[0] : null;
};

const getMovieTitleFromNominee = (nominee: NomineeRecord, categoryId: string): string | null => {
  if (isPersonCategory(categoryId)) {
    return nominee.film?.trim() || null;
  }

  if (nominee.film?.trim()) {
    return nominee.film.trim();
  }

  if (categoryId === 'music-song' && nominee.song) {
    const match = nominee.song.match(/from\s+([^;]+)/i);
    return match?.[1]?.trim() || null;
  }

  if (nominee.name?.trim()) {
    return nominee.name.trim();
  }

  return null;
};

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  const prefix = `${flag}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

async function backfillMovieImdbIds() {
  const yearArg = getArgValue('--year');
  const year = yearArg?.trim();
  const movieYearArg = getArgValue('--movie-year');
  const movieYear = movieYearArg ? Number.parseInt(movieYearArg, 10) : null;
  const hasMovieYear = Number.isFinite(movieYear ?? Number.NaN);

  console.log('Backfilling movie imdbId from nominee imdb_url...');
  if (year) {
    console.log(`- Filtering nominees for award year: ${year}`);
  }
  if (hasMovieYear) {
    console.log(`- Restricting movie matches to release year: ${movieYear}`);
  }

  const nominees = await prisma.nominee.findMany({
    where: {
      imdb_url: { not: null },
      ...(year ? { categoryId: { endsWith: `-${year}` } } : {}),
    },
    select: {
      name: true,
      film: true,
      song: true,
      imdb_url: true,
      categoryId: true,
    },
  });

  const movies = await prisma.movie.findMany({
    select: {
      id: true,
      title: true,
      year: true,
      imdbId: true,
    },
  });

  const moviesBySlug = new Map<string, MovieRecord[]>();
  for (const movie of movies) {
    const key = filmNameToSlug(movie.title);
    const existing = moviesBySlug.get(key);
    if (existing) {
      existing.push(movie);
    } else {
      moviesBySlug.set(key, [movie]);
    }
  }

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  let missing = 0;
  let ambiguous = 0;
  let invalidImdb = 0;
  let personCategory = 0;

  for (const nominee of nominees) {
    const categoryBaseId = stripYearSuffix(nominee.categoryId);
    if (isPersonCategory(categoryBaseId)) {
      personCategory += 1;
      continue;
    }

    const imdbId = extractImdbId(nominee.imdb_url);
    if (!imdbId) {
      invalidImdb += 1;
      continue;
    }

    const title = getMovieTitleFromNominee(nominee, categoryBaseId);
    if (!title) {
      skipped += 1;
      continue;
    }

    const key = filmNameToSlug(title);
    const candidates = moviesBySlug.get(key);
    if (!candidates || candidates.length === 0) {
      missing += 1;
      continue;
    }

    let filtered = candidates;
    if (hasMovieYear && movieYear !== null) {
      filtered = candidates.filter((movie) => movie.year === movieYear);
    }

    let match: MovieRecord | undefined;
    if (filtered.length === 1) {
      match = filtered[0];
    } else {
      const titleMatches = filtered.filter(
        (movie) => movie.title.toLowerCase() === title.toLowerCase(),
      );
      if (titleMatches.length === 1) {
        match = titleMatches[0];
      }
    }

    if (!match) {
      ambiguous += 1;
      continue;
    }

    if (match.imdbId) {
      if (match.imdbId === imdbId) {
        unchanged += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    await prisma.movie.update({
      where: { id: match.id },
      data: { imdbId },
    });
    match.imdbId = imdbId;
    updated += 1;
  }

  console.log('\nBackfill complete:');
  console.log(`- Updated: ${updated}`);
  console.log(`- Unchanged: ${unchanged}`);
  console.log(`- Missing movie match: ${missing}`);
  console.log(`- Ambiguous movie match: ${ambiguous}`);
  console.log(`- Skipped (no title or imdbId mismatch): ${skipped}`);
  console.log(`- Invalid imdb_url: ${invalidImdb}`);
  console.log(`- Person categories skipped: ${personCategory}`);
}

backfillMovieImdbIds()
  .catch((error) => {
    console.error('Error backfilling movie imdbId:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
