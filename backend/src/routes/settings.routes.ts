import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { PoolService } from '../services/pool.service';

const router = Router();
const prisma = new PrismaClient();
const poolService = new PoolService();

// Update pool settings (pool owner or superuser)
router.put('/:poolId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { categoryPoints, oddsMultiplierEnabled, oddsMultiplierFormula, payoutStructure } = req.body;

    // Verify user is pool owner or superuser
    const isOwner = await poolService.isPoolOwner(poolId, userId);
    const isSuperuser = userRole === 'SUPERUSER';
    if (!isOwner && !isSuperuser) {
      res.status(403).json({ error: 'Only pool owner or superuser can update settings' });
      return;
    }

    // Get pool to find its year
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { year: true },
    });

    if (!pool) {
      res.status(404).json({ error: 'Pool not found' });
      return;
    }

    // Check for global winners for this year (from global pool)
    const globalPool = await prisma.pool.findFirst({
      where: {
        name: `Global Oscars Pool ${pool.year}`,
        year: pool.year,
        isPublic: true,
      },
    });

    let hasWinners = false;
    if (globalPool) {
      const winnerCount = await prisma.actualWinner.count({
        where: { poolId: globalPool.id },
      });
      hasWinners = winnerCount > 0;
    }

    // If no global winners, check pool-specific winners
    if (!hasWinners) {
      const winnerCount = await prisma.actualWinner.count({
        where: { poolId },
      });
      hasWinners = winnerCount > 0;
    }

    if (hasWinners) {
      res.status(403).json({ error: 'Cannot update pool settings after winners have been announced' });
      return;
    }

    const updateData: any = {
      categoryPoints: categoryPoints || undefined,
      oddsMultiplierEnabled: oddsMultiplierEnabled !== undefined ? oddsMultiplierEnabled : undefined,
      oddsMultiplierFormula: oddsMultiplierFormula || undefined,
    };
    
    if (payoutStructure !== undefined) {
      updateData.payoutStructure = payoutStructure;
    }
    
    const settings = await prisma.poolSettings.update({
      where: { poolId },
      data: updateData,
    });

    res.json(settings);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get pool settings
router.get('/:poolId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Verify user is a member
    await poolService.getPoolById(poolId, userId, userRole);

    const settings = await prisma.poolSettings.findUnique({
      where: { poolId },
    });

    if (!settings) {
      res.status(404).json({ error: 'Settings not found' });
      return;
    }

    res.json(settings);
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

export default router;
