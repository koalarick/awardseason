import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { OddsService } from '../services/odds.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();
const oddsService = new OddsService();

// Get current odds for all nominees in a category (no auth required for public data)
router.get('/category/:categoryId', async (req, res: Response) => {
  try {
    const { categoryId } = req.params;

    // Get all nominees for this category from the database
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        nominees: true,
      },
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    // Get odds for each nominee
    const nomineesWithOdds = await Promise.all(
      category.nominees.map(async (nominee: any) => {
        const odds = await oddsService.getCurrentOdds(categoryId, nominee.id);
        return {
          nomineeId: nominee.id,
          odds,
        };
      }),
    );

    res.json({ nominees: nomineesWithOdds });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current odds for a nominee
router.get('/:categoryId/:nomineeId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { categoryId, nomineeId } = req.params;
    const odds = await oddsService.getCurrentOdds(categoryId, nomineeId);
    res.json({ odds });
  } catch (error: any) {
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
    } catch (error: any) {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
