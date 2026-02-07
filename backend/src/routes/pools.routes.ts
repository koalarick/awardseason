import { Router, Response } from 'express';
import { PoolService } from '../services/pool.service';
import { authenticate, requireSuperuser, AuthRequest } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const router = Router();
const poolService = new PoolService();

// Create pool
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      year,
      ceremonyDate,
      password,
      isPublic,
      isPaidPool,
      entryAmount,
      venmoAlias,
      payoutStructure,
      oddsMultiplierEnabled,
      oddsMultiplierFormula,
      categoryPoints,
    } = req.body;
    const userId = req.user!.id;

    if (!name) {
      res.status(400).json({ error: 'Pool name is required' });
      return;
    }

    // Default to current year's Oscars if not provided
    const currentYear = new Date().getFullYear().toString();
    const poolYear = year || currentYear;

    // Default ceremony date to March 10th of the current year at 8pm ET (typical Oscars time)
    // If year is provided, use that year; otherwise use current year
    let defaultCeremonyDate: Date;
    if (ceremonyDate) {
      defaultCeremonyDate = new Date(ceremonyDate);
    } else {
      const ceremonyYear = parseInt(poolYear);
      // Oscars are typically in late February or early March
      // Default to March 10th at 8pm ET (20:00)
      defaultCeremonyDate = new Date(ceremonyYear, 2, 10, 20, 0, 0); // Month is 0-indexed, so 2 = March
    }

    // Validate paid pool fields
    if (isPaidPool) {
      if (!entryAmount || entryAmount <= 0) {
        res
          .status(400)
          .json({ error: 'Entry amount is required and must be greater than 0 for paid pools' });
        return;
      }
      if (!venmoAlias || venmoAlias.trim() === '') {
        res.status(400).json({ error: 'Venmo alias is required for paid pools' });
        return;
      }
    }

    const pool = await poolService.createPool(
      userId,
      name,
      poolYear,
      defaultCeremonyDate,
      password,
      isPublic,
      isPaidPool || false,
      entryAmount,
      venmoAlias,
      payoutStructure,
      oddsMultiplierEnabled,
      oddsMultiplierFormula,
      categoryPoints,
    );

    res.status(201).json(pool);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's pools
router.get('/my-pools', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const pools = await poolService.getUserPools(userId);
    res.json(pools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get global stats (superuser only)
router.get('/stats', authenticate, requireSuperuser, async (_req: AuthRequest, res: Response) => {
  try {
    const [totalUsers, totalPools] = await Promise.all([prisma.user.count(), prisma.pool.count()]);

    res.json({ totalUsers, totalPools });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all pools (superuser only)
router.get('/all', authenticate, requireSuperuser, async (req: AuthRequest, res: Response) => {
  try {
    const pools = await prisma.pool.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
          },
        },
        _count: {
          select: {
            members: true,
            predictions: true,
            actualWinners: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(pools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get public pools (no auth required)
router.get('/public', async (req: AuthRequest, res: Response) => {
  try {
    const pools = await poolService.getPublicPools();
    res.json(pools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get global pool (no auth required)
router.get('/global', async (req: AuthRequest, res: Response) => {
  try {
    const pool = await poolService.getGlobalPool();
    if (!pool) {
      res.status(404).json({ error: 'Global pool not found' });
      return;
    }
    res.json(pool);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search pools (authenticated)
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    const userId = req.user!.id;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const pools = await poolService.searchPools(userId, q);
    res.json(pools);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get public pool info (for invite page, no auth required)
router.get('/:poolId/info', async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const pool = await poolService.getPoolInfoPublic(poolId);
    res.json(pool);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Get pool by ID (requires membership)
router.get('/:poolId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const pool = await poolService.getPoolById(poolId, userId, userRole);
    res.json(pool);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Join pool
router.post('/:poolId/join', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const { password } = req.body;
    const userId = req.user!.id;

    const member = await poolService.joinPool(userId, poolId, password);
    res.status(201).json(member);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get pool members
router.get('/:poolId/members', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const members = await poolService.getPoolMembers(poolId, userId, userRole);
    res.json(members);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// Update submission name
router.patch('/:poolId/submission-name', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const { submissionName } = req.body;
    const userId = req.user!.id;

    if (submissionName !== undefined && typeof submissionName !== 'string') {
      res.status(400).json({ error: 'Submission name must be a string' });
      return;
    }

    const updated = await poolService.updateSubmissionName(userId, poolId, submissionName || '');
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all submissions for a pool with metadata
router.get('/:poolId/submissions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check if user is a member
    const membership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId,
          userId,
        },
      },
    });

    // Check if pool exists and is public
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { isPublic: true },
    });

    if (!pool) {
      res.status(404).json({ error: 'Pool not found' });
      return;
    }

    // Allow access if user is a member OR pool is public
    if (!membership && !pool.isPublic && userRole !== 'SUPERUSER') {
      res.status(403).json({ error: 'Not a member of this pool' });
      return;
    }

    const submissions = await poolService.getPoolSubmissions(poolId);

    // Return empty array if no submissions, not an error
    res.json(submissions || []);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get seen movie counts for members of a pool
router.get('/:poolId/seen-movies/:year/counts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId, year } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (!year) {
      res.status(400).json({ error: 'Year is required' });
      return;
    }

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { isPublic: true },
    });

    if (!pool) {
      res.status(404).json({ error: 'Pool not found' });
      return;
    }

    if (userRole !== 'SUPERUSER') {
      const membership = await prisma.poolMember.findUnique({
        where: {
          poolId_userId: {
            poolId,
            userId,
          },
        },
      });

      if (!membership && !pool.isPublic) {
        res.status(403).json({ error: 'Not a member of this pool' });
        return;
      }
    }

    const members = await prisma.poolMember.findMany({
      where: { poolId },
      select: { userId: true },
    });

    const memberIds = members.map((member) => member.userId);
    if (memberIds.length === 0) {
      res.json({ counts: {} });
      return;
    }

    const counts = await prisma.seenMovie.groupBy({
      by: ['userId'],
      where: { year, userId: { in: memberIds } },
      _count: { _all: true },
    });

    const countMap = counts.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.userId] = entry._count._all;
      return acc;
    }, {});

    res.json({ counts: countMap });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load seen counts';
    res.status(500).json({ error: message });
  }
});

// Update pool (owner only)
router.put('/:poolId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { name, isPaidPool, entryAmount, venmoAlias } = req.body;

    // Verify user is pool owner or superuser
    const isOwner = await poolService.isPoolOwner(poolId, userId);
    const isSuperuser = userRole === 'SUPERUSER';
    if (!isOwner && !isSuperuser) {
      res.status(403).json({ error: 'Only pool owner or superuser can update pool' });
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
      res
        .status(403)
        .json({ error: 'Cannot update pool settings after winners have been announced' });
      return;
    }

    // Validate paid pool fields if enabling paid pool
    if (isPaidPool === true) {
      if (entryAmount !== undefined && (!entryAmount || entryAmount <= 0)) {
        res.status(400).json({ error: 'Entry amount must be greater than 0 for paid pools' });
        return;
      }
      if (venmoAlias !== undefined && (!venmoAlias || venmoAlias.trim() === '')) {
        res.status(400).json({ error: 'Venmo alias is required for paid pools' });
        return;
      }
    }

    const updatedPool = await poolService.updatePool(poolId, userId, {
      name,
      isPaidPool,
      entryAmount: entryAmount !== undefined ? entryAmount : undefined,
      venmoAlias: venmoAlias !== undefined ? venmoAlias : undefined,
    });

    res.json(updatedPool);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Mark member as paid/unpaid (owner only)
router.patch(
  '/:poolId/members/:userId/payment',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { poolId, userId: memberUserId } = req.params;
      const ownerUserId = req.user!.id;
      const userRole = req.user!.role;
      const { hasPaid } = req.body;

      // Verify requester is pool owner or superuser
      const isOwner = await poolService.isPoolOwner(poolId, ownerUserId);
      const isSuperuser = userRole === 'SUPERUSER';
      if (!isOwner && !isSuperuser) {
        res.status(403).json({ error: 'Only pool owner or superuser can mark payment status' });
        return;
      }

      if (typeof hasPaid !== 'boolean') {
        res.status(400).json({ error: 'hasPaid must be a boolean' });
        return;
      }

      const member = await poolService.markMemberAsPaid(poolId, memberUserId, ownerUserId, hasPaid);

      res.json(member);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

// Delete pool (owner only)
router.delete('/:poolId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Verify user is pool owner or superuser
    const isOwner = await poolService.isPoolOwner(poolId, userId);
    const isSuperuser = userRole === 'SUPERUSER';
    if (!isOwner && !isSuperuser) {
      res.status(403).json({ error: 'Only pool owner or superuser can delete pool' });
      return;
    }

    await poolService.deletePool(poolId, userId, userRole);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Remove submission from pool (owner or superuser only)
router.delete(
  '/:poolId/submissions/:userId',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { poolId, userId: targetUserId } = req.params;
      const requesterUserId = req.user!.id;
      const requesterRole = req.user!.role;

      await poolService.removeSubmission(poolId, targetUserId, requesterUserId, requesterRole);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
);

export default router;
