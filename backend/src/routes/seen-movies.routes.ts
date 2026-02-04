import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

const normalizeYear = (yearParam?: string) => (yearParam || '').trim();

router.get('/:year', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const year = normalizeYear(req.params.year);
    if (!year) {
      res.status(400).json({ error: 'Year is required' });
      return;
    }
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const seenMovies = await prisma.seenMovie.findMany({
      where: { userId, year },
      select: { movieId: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ movieIds: seenMovies.map((entry) => entry.movieId) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:year', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const year = normalizeYear(req.params.year);
    if (!year) {
      res.status(400).json({ error: 'Year is required' });
      return;
    }
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { movieIds } = req.body as { movieIds?: string[] };
    if (!Array.isArray(movieIds)) {
      res.status(400).json({ error: 'movieIds must be an array' });
      return;
    }

    const sanitized = Array.from(
      new Set(movieIds.filter((id) => typeof id === 'string' && id.trim())),
    );

    const now = new Date();

    await prisma.$transaction([
      prisma.seenMovie.deleteMany({ where: { userId, year } }),
      prisma.seenMovie.createMany({
        data: sanitized.map((movieId) => ({
          userId,
          year,
          movieId,
          createdAt: now,
          updatedAt: now,
        })),
        skipDuplicates: true,
      }),
    ]);

    res.json({ movieIds: sanitized });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:year', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const year = normalizeYear(req.params.year);
    if (!year) {
      res.status(400).json({ error: 'Year is required' });
      return;
    }
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { movieId, seen } = req.body as { movieId?: string; seen?: boolean };
    if (!movieId || typeof movieId !== 'string') {
      res.status(400).json({ error: 'movieId is required' });
      return;
    }

    const shouldMarkSeen = typeof seen === 'boolean' ? seen : true;

    if (shouldMarkSeen) {
      await prisma.seenMovie.upsert({
        where: {
          userId_year_movieId: {
            userId,
            year,
            movieId,
          },
        },
        create: {
          userId,
          year,
          movieId,
        },
        update: {
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.seenMovie.deleteMany({
        where: { userId, year, movieId },
      });
    }

    res.json({ movieId, seen: shouldMarkSeen });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
