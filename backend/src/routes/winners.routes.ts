import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { PoolService } from '../services/pool.service';

const router = Router();
const prisma = new PrismaClient();
const poolService = new PoolService();

// Enter actual winner (pool owner or superuser)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId, categoryId, nomineeId } = req.body;
    const userId = req.user!.id;
    const isSuperuser = req.user!.role === 'SUPERUSER';

    if (!poolId || !categoryId || !nomineeId) {
      res.status(400).json({ error: 'Pool ID, category ID, and nominee ID are required' });
      return;
    }

    // Verify user is pool owner or superuser
    if (!isSuperuser) {
      const isOwner = await poolService.isPoolOwner(poolId, userId);
      if (!isOwner) {
        res.status(403).json({ error: 'Only pool owner or superuser can enter winners' });
        return;
      }
    }

    const winner = await prisma.actualWinner.upsert({
      where: {
        poolId_categoryId: {
          poolId,
          categoryId,
        },
      },
      update: {
        nomineeId,
        enteredBy: userId,
        isAutoDetected: false,
        updatedAt: new Date(),
      },
      create: {
        poolId,
        categoryId,
        nomineeId,
        enteredBy: userId,
        isAutoDetected: false,
      },
    });

    res.json(winner);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get winners for a pool
router.get('/pool/:poolId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Verify user is a member
    await poolService.getPoolById(poolId, userId, userRole);

    const winners = await prisma.actualWinner.findMany({
      where: { poolId },
      include: {
        enteredByUser: {
          select: {
            id: true,
            // Exclude email for privacy - user ID is sufficient
          },
        },
      },
    });

    // Normalize categoryId to base format (remove year suffix) for frontend compatibility
    // Frontend expects base IDs like "best-picture", not "best-picture-2026"
    const normalizedWinners = winners.map((winner) => ({
      ...winner,
      categoryId: winner.categoryId.replace(/-\d{4}$/, ''),
    }));

    res.json(normalizedWinners);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// Get global winners for a year (all authenticated users can view)
router.get('/global/:year', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.params;

    // Get global pool for this year
    const globalPool = await prisma.pool.findFirst({
      where: {
        name: `Global Oscars Pool ${year}`,
        year,
        isPublic: true,
      },
    });

    if (!globalPool) {
      res.json([]);
      return;
    }

    const winners = await prisma.actualWinner.findMany({
      where: { poolId: globalPool.id },
      include: {
        enteredByUser: {
          select: {
            id: true,
            // Exclude email for privacy - user ID is sufficient
          },
        },
      },
    });

    // Normalize categoryId to base format (remove year suffix) for frontend compatibility
    // Frontend expects base IDs like "best-picture", not "best-picture-2026"
    const normalizedWinners = winners.map((winner) => ({
      ...winner,
      categoryId: winner.categoryId.replace(/-\d{4}$/, ''),
    }));

    res.json(normalizedWinners);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Set global winner for a year (superuser only)
router.post('/global', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { year, categoryId, nomineeId } = req.body;
    const userId = req.user!.id;
    const isSuperuser = req.user!.role === 'SUPERUSER';

    if (!isSuperuser) {
      res.status(403).json({ error: 'Superuser access required' });
      return;
    }

    if (!year || !categoryId || !nomineeId) {
      res.status(400).json({ error: 'Year, category ID, and nominee ID are required' });
      return;
    }

    // Get or create global pool for this year
    let globalPool = await prisma.pool.findFirst({
      where: {
        name: `Global Oscars Pool ${year}`,
        year,
        isPublic: true,
      },
    });

    if (!globalPool) {
      // Create global pool if it doesn't exist
      const ceremonyDate = new Date(`${year}-03-10T20:00:00Z`);
      globalPool = await prisma.pool.create({
        data: {
          name: `Global Oscars Pool ${year}`,
          year,
          ceremonyDate,
          isPublic: true,
          passwordHash: null,
          ownerId: userId,
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
    }

    const winner = await prisma.actualWinner.upsert({
      where: {
        poolId_categoryId: {
          poolId: globalPool.id,
          categoryId,
        },
      },
      update: {
        nomineeId,
        enteredBy: userId,
        isAutoDetected: false,
        updatedAt: new Date(),
      },
      create: {
        poolId: globalPool.id,
        categoryId,
        nomineeId,
        enteredBy: userId,
        isAutoDetected: false,
      },
    });

    res.json(winner);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete global winner for a category (superuser only)
router.delete(
  '/global/:year/:categoryId',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { year, categoryId } = req.params;
      const isSuperuser = req.user!.role === 'SUPERUSER';

      if (!isSuperuser) {
        res.status(403).json({ error: 'Superuser access required' });
        return;
      }

      if (!year || !categoryId) {
        res.status(400).json({ error: 'Year and category ID are required' });
        return;
      }

      // Get global pool for this year
      const globalPool = await prisma.pool.findFirst({
        where: {
          name: `Global Oscars Pool ${year}`,
          year,
          isPublic: true,
        },
      });

      if (!globalPool) {
        res.status(404).json({ error: 'Global pool not found' });
        return;
      }

      // Delete the winner for this category
      await prisma.actualWinner.delete({
        where: {
          poolId_categoryId: {
            poolId: globalPool.id,
            categoryId,
          },
        },
      });

      res.json({ success: true });
    } catch (error) {
      if (error.code === 'P2025') {
        // Record not found
        res.status(404).json({ error: 'Winner not found' });
      } else {
        res.status(400).json({ error: error.message });
      }
    }
  },
);

export default router;
