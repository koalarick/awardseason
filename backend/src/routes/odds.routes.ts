import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { OddsService } from '../services/odds.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();
const oddsService = new OddsService();

// Get current odds for all nominees in a year (single call for ballot load)
router.get('/year/:year', async (req, res: Response) => {
  try {
    const { year } = req.params;
    if (!year) {
      res.status(400).json({ error: 'Year is required' });
      return;
    }

    const categories = await prisma.category.findMany({
      where: { year },
      select: {
        id: true,
        nominees: {
          select: { id: true },
        },
      },
    });

    if (!categories.length) {
      res.json({ odds: {} });
      return;
    }

    const nomineePairs = categories.flatMap((category) =>
      category.nominees.map((nominee) => ({
        categoryId: category.id,
        nomineeId: nominee.id,
      })),
    );
    const oddsByCategory = await oddsService.getCurrentOddsForNomineePairs(nomineePairs);
    const oddsMap: Record<string, Array<{ nomineeId: string; odds: number | null }>> = {};

    categories.forEach((category) => {
      const oddsByNominee = oddsByCategory[category.id] ?? {};
      const baseCategoryId = category.id.includes(`-${year}`)
        ? category.id.replace(`-${year}`, '')
        : category.id.replace(/-\d{4}$/, '');

      oddsMap[baseCategoryId] = category.nominees.map((nominee) => ({
        nomineeId: nominee.id,
        odds: oddsByNominee[nominee.id] ?? null,
      }));
    });

    res.json({ odds: oddsMap });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current odds for all nominees in a category (no auth required for public data)
router.get('/category/:categoryId', async (req, res: Response) => {
  try {
    const { categoryId } = req.params;

    // Get all nominees for this category from the database
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        nominees: {
          select: { id: true },
        },
      },
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const nomineePairs = category.nominees.map((nominee) => ({
      categoryId,
      nomineeId: nominee.id,
    }));
    const oddsByCategory = await oddsService.getCurrentOddsForNomineePairs(nomineePairs);
    const oddsByNominee = oddsByCategory[categoryId] ?? {};
    const nomineesWithOdds = category.nominees.map((nominee) => ({
      nomineeId: nominee.id,
      odds: oddsByNominee[nominee.id] ?? null,
    }));

    res.json({ nominees: nomineesWithOdds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current odds for a nominee
router.get('/:categoryId/:nomineeId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId, nomineeId } = req.params;
    const odds = await oddsService.getCurrentOdds(categoryId, nomineeId);
    res.json({ odds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get odds at a specific time
router.post(
  '/:categoryId/:nomineeId/at-time',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { categoryId, nomineeId } = req.params;
      const { timestamp } = req.body;

      if (!timestamp) {
        res.status(400).json({ error: 'Timestamp is required' });
        return;
      }

      const odds = await oddsService.getOddsAtTime(categoryId, nomineeId, new Date(timestamp));
      res.json({ odds });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// Get odds history/trend for a nominee
router.get('/:categoryId/:nomineeId/history', async (req, res: Response) => {
  try {
    const { categoryId, nomineeId } = req.params;

    // Get all snapshots for this nominee, ordered by time
    const snapshots = await prisma.oddsSnapshot.findMany({
      where: {
        categoryId,
        nomineeId,
      },
      orderBy: {
        snapshotTime: 'asc',
      },
      select: {
        oddsPercentage: true,
        snapshotTime: true,
      },
    });

    res.json({ history: snapshots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
