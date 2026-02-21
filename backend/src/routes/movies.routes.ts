import { Router, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticate, requireSuperuser, AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

const normalizeYear = (yearParam?: string) => (yearParam || '').trim();

type MovieRecord = {
  id: string;
  slug: string;
  title: string;
  year: number;
  imdbId: string | null;
  letterboxdUrl: string | null;
  tmdbId: number | null;
  wikidataId: string | null;
  posterPath: string | null;
  posterImageId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const formatMovie = (movie: MovieRecord) => ({
  id: movie.id,
  slug: movie.slug,
  title: movie.title,
  year: movie.year,
  imdbId: movie.imdbId || undefined,
  letterboxdUrl: movie.letterboxdUrl || undefined,
  tmdbId: movie.tmdbId ?? undefined,
  wikidataId: movie.wikidataId || undefined,
  posterPath: movie.posterPath || undefined,
  posterImageId: movie.posterImageId || undefined,
  createdAt: movie.createdAt,
  updatedAt: movie.updatedAt,
});

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

const getUniqueMovieSlug = async (title: string, year: number) => {
  const baseSlug = filmNameToSlug(title);
  const existing = await prisma.movie.findMany({
    where: { slug: { startsWith: baseSlug } },
    select: { slug: true },
  });
  const existingSlugs = new Set(existing.map((entry) => entry.slug));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  const yearSlug = `${baseSlug}-${year}`;
  if (!existingSlugs.has(yearSlug)) {
    return yearSlug;
  }

  let counter = 2;
  let candidate = `${yearSlug}-${counter}`;
  while (existingSlugs.has(candidate)) {
    counter += 1;
    candidate = `${yearSlug}-${counter}`;
  }

  return candidate;
};

router.get('/', async (_req, res: Response) => {
  try {
    const movies = await prisma.movie.findMany({
      orderBy: [{ year: 'desc' }, { title: 'asc' }],
    });

    if (!movies.length) {
      res.status(404).json({ error: 'No movies found.' });
      return;
    }

    res.json(movies.map((movie) => formatMovie(movie)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load movies';
    res.status(500).json({ error: message });
  }
});

router.get('/:year', async (req, res: Response) => {
  try {
    const yearParam = normalizeYear(req.params.year);
    if (!yearParam) {
      res.status(400).json({ error: 'Year is required' });
      return;
    }

    const year = Number.parseInt(yearParam, 10);
    if (!Number.isFinite(year)) {
      res.status(400).json({ error: 'Year must be a number' });
      return;
    }

    const movies = await prisma.movie.findMany({
      where: { year },
      orderBy: { title: 'asc' },
    });

    if (!movies.length) {
      res.status(404).json({ error: `No movies found for year ${year}` });
      return;
    }

    res.json(movies.map((movie) => formatMovie(movie)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load movies';
    res.status(500).json({ error: message });
  }
});

router.post(
  '/',
  authenticate,
  requireSuperuser,
  async (req: AuthRequest, res: Response) => {
    try {
      const rawTitle = req.body?.title;
      if (typeof rawTitle !== 'string' || !rawTitle.trim()) {
        res.status(400).json({ error: 'title is required' });
        return;
      }

      const rawYear = req.body?.year;
      const parsedYear =
        typeof rawYear === 'number' ? rawYear : Number.parseInt(String(rawYear), 10);
      if (!Number.isFinite(parsedYear) || parsedYear <= 0) {
        res.status(400).json({ error: 'year must be a positive number' });
        return;
      }

      const title = rawTitle.trim();
      const existingMovie = await prisma.movie.findFirst({
        where: {
          title: { equals: title, mode: 'insensitive' },
          year: parsedYear,
        },
      });

      if (existingMovie) {
        res.status(409).json({ error: `Movie already exists for year ${parsedYear}` });
        return;
      }

      const optionalStringFields = [
        'imdbId',
        'letterboxdUrl',
        'wikidataId',
        'posterPath',
        'posterImageId',
      ] as const;
      type OptionalStringField = (typeof optionalStringFields)[number];

      const createData: Prisma.MovieCreateInput = {
        title,
        year: parsedYear,
        slug: await getUniqueMovieSlug(title, parsedYear),
      };

      for (const field of optionalStringFields) {
        if (!(field in req.body)) {
          continue;
        }
        const rawValue = req.body[field];

        if (rawValue !== null && typeof rawValue !== 'string') {
          res.status(400).json({ error: `${field} must be a string or null` });
          return;
        }

        if (rawValue === null) {
          createData[field] = null;
          continue;
        }

        const trimmed = rawValue.trim();
        createData[field] = trimmed.length > 0 ? trimmed : null;
      }

      if ('tmdbId' in req.body) {
        const rawTmdb = req.body.tmdbId;
        if (rawTmdb === null || rawTmdb === '') {
          createData.tmdbId = null;
        } else {
          const parsedTmdb =
            typeof rawTmdb === 'number' ? rawTmdb : Number.parseInt(String(rawTmdb), 10);

          if (!Number.isFinite(parsedTmdb)) {
            res.status(400).json({ error: 'tmdbId must be a number or null' });
            return;
          }

          createData.tmdbId = parsedTmdb;
        }
      }

      const createdMovie = await prisma.movie.create({ data: createData });

      res.status(201).json(formatMovie(createdMovie));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({ error: 'Movie already exists or violates unique constraint' });
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to create movie';
      res.status(500).json({ error: message });
    }
  },
);

router.patch(
  '/:movieId',
  authenticate,
  requireSuperuser,
  async (req: AuthRequest, res: Response) => {
    try {
      const { movieId } = req.params;

      if (!movieId) {
        res.status(400).json({ error: 'Movie ID is required' });
        return;
      }

      const movie = await prisma.movie.findFirst({
        where: {
          OR: [{ id: movieId }, { slug: movieId }],
        },
      });

      if (!movie) {
        res.status(404).json({ error: 'Movie not found' });
        return;
      }

      const stringFields = [
        'title',
        'imdbId',
        'letterboxdUrl',
        'wikidataId',
        'posterPath',
        'posterImageId',
      ] as const;
      type MovieStringField = (typeof stringFields)[number];

      const updateData: Prisma.MovieUpdateInput = {};

      for (const field of stringFields) {
        if (!(field in req.body)) continue;
        const rawValue = req.body[field];

        if (rawValue !== null && typeof rawValue !== 'string') {
          res.status(400).json({ error: `${field} must be a string or null` });
          return;
        }

        if (rawValue === null) {
          if (field !== 'title') {
            updateData[field] = null;
          }
          continue;
        }

        const trimmed = rawValue.trim();
        if (field === 'title') {
          if (trimmed.length > 0) {
            updateData.title = trimmed;
          }
        } else {
          updateData[field] = trimmed.length > 0 ? trimmed : null;
        }
      }

      if ('year' in req.body) {
        const rawYear = req.body.year;
        const parsedYear =
          typeof rawYear === 'number' ? rawYear : Number.parseInt(String(rawYear), 10);

        if (!Number.isFinite(parsedYear)) {
          res.status(400).json({ error: 'year must be a number' });
          return;
        }

        updateData.year = parsedYear;
      }

      if ('tmdbId' in req.body) {
        const rawTmdb = req.body.tmdbId;
        if (rawTmdb === null || rawTmdb === '') {
          updateData.tmdbId = null;
        } else {
          const parsedTmdb =
            typeof rawTmdb === 'number' ? rawTmdb : Number.parseInt(String(rawTmdb), 10);

          if (!Number.isFinite(parsedTmdb)) {
            res.status(400).json({ error: 'tmdbId must be a number or null' });
            return;
          }

          updateData.tmdbId = parsedTmdb;
        }
      }

      if ('title' in updateData && !updateData.title) {
        res.status(400).json({ error: 'title cannot be empty' });
        return;
      }

      if ('year' in updateData) {
        const yearValue = updateData.year;
        if (typeof yearValue !== 'number' || !Number.isFinite(yearValue) || yearValue <= 0) {
          res.status(400).json({ error: 'year must be a positive number' });
          return;
        }
      }

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({ error: 'No fields provided to update' });
        return;
      }

      const updatedMovie = await prisma.movie.update({
        where: { id: movie.id },
        data: updateData,
      });

      res.json(formatMovie(updatedMovie));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update movie';
      res.status(500).json({ error: message });
    }
  },
);

router.delete(
  '/:movieId',
  authenticate,
  requireSuperuser,
  async (req: AuthRequest, res: Response) => {
    try {
      const { movieId } = req.params;
      if (!movieId) {
        res.status(400).json({ error: 'Movie ID is required' });
        return;
      }

      const movie = await prisma.movie.findFirst({
        where: {
          OR: [{ id: movieId }, { slug: movieId }],
        },
      });

      if (!movie) {
        res.status(404).json({ error: 'Movie not found' });
        return;
      }

      await prisma.$transaction([
        prisma.seenMovie.deleteMany({ where: { movieId: movie.id } }),
        prisma.movie.delete({ where: { id: movie.id } }),
      ]);

      res.json({
        id: movie.id,
        slug: movie.slug,
        title: movie.title,
        year: movie.year,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete movie';
      res.status(500).json({ error: message });
    }
  },
);

export default router;
