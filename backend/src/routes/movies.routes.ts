import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireSuperuser, AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

const normalizeYear = (yearParam?: string) => (yearParam || '').trim();

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

    res.json(
      movies.map((movie) => ({
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
      })),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load movies';
    res.status(500).json({ error: message });
  }
});

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

      const updateData: Partial<Record<MovieStringField, string | null>> & {
        year?: number;
        tmdbId?: number | null;
      } = {};

      for (const field of stringFields) {
        if (!(field in req.body)) continue;
        const rawValue = req.body[field];

        if (rawValue !== null && typeof rawValue !== 'string') {
          res.status(400).json({ error: `${field} must be a string or null` });
          return;
        }

        if (rawValue === null) {
          updateData[field] = null;
          continue;
        }

        const trimmed = rawValue.trim();
        updateData[field] = trimmed.length > 0 ? trimmed : null;
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

      if ('year' in updateData && (!Number.isFinite(updateData.year) || updateData.year <= 0)) {
        res.status(400).json({ error: 'year must be a positive number' });
        return;
      }

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({ error: 'No fields provided to update' });
        return;
      }

      const updatedMovie = await prisma.movie.update({
        where: { id: movie.id },
        data: updateData,
      });

      res.json({
        id: updatedMovie.id,
        slug: updatedMovie.slug,
        title: updatedMovie.title,
        year: updatedMovie.year,
        imdbId: updatedMovie.imdbId || undefined,
        letterboxdUrl: updatedMovie.letterboxdUrl || undefined,
        tmdbId: updatedMovie.tmdbId ?? undefined,
        wikidataId: updatedMovie.wikidataId || undefined,
        posterPath: updatedMovie.posterPath || undefined,
        posterImageId: updatedMovie.posterImageId || undefined,
        createdAt: updatedMovie.createdAt,
        updatedAt: updatedMovie.updatedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update movie';
      res.status(500).json({ error: message });
    }
  },
);

export default router;
