import { Router, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { authenticate, requireSuperuser, AuthRequest } from '../middleware/auth.middleware';
import { AuthService } from '../auth/auth.service';

const prisma = new PrismaClient();
const router = Router();
const authService = new AuthService();

// Get all users (superuser only)
router.get('/', authenticate, requireSuperuser, async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        oauthProvider: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            ownedPools: true,
            poolMemberships: true,
            predictions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user role (superuser only)
router.patch('/:userId/role', authenticate, requireSuperuser, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body as { role?: string };
    const roleValue = role as UserRole;

    if (!role || !Object.values(UserRole).includes(roleValue)) {
      res.status(400).json({ error: 'Role must be USER or SUPERUSER' });
      return;
    }

    if (req.user?.id === userId && roleValue !== 'SUPERUSER') {
      res.status(400).json({ error: 'You cannot remove your own superuser role' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: roleValue },
      select: {
        id: true,
        email: true,
        role: true,
        oauthProvider: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user password (superuser only, password users only)
router.patch('/:userId/password', authenticate, requireSuperuser, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { password } = req.body as { password?: string };

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, oauthProvider: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.passwordHash) {
      res.status(400).json({ error: 'Password changes are not allowed for OAuth users' });
      return;
    }

    const passwordHash = await authService.hashPassword(password);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user (superuser only)
router.delete('/:userId', authenticate, requireSuperuser, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    if (req.user?.id === userId) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (targetUser.role === 'SUPERUSER') {
      const superuserCount = await prisma.user.count({ where: { role: 'SUPERUSER' } });
      if (superuserCount <= 1) {
        res.status(400).json({ error: 'You cannot delete the last superuser' });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.actualWinner.updateMany({
        where: { enteredBy: userId },
        data: { enteredBy: null },
      });

      await tx.$executeRaw`
        UPDATE events
        SET user_id = NULL
        WHERE user_id = ${userId}
      `;

      await tx.user.delete({
        where: { id: userId },
      });
    });

    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a user's seen movies for a given year (superuser only)
router.get(
  '/:userId/seen-movies/:year',
  authenticate,
  requireSuperuser,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId, year } = req.params;
      if (!userId || !year) {
        res.status(400).json({ error: 'User ID and year are required' });
        return;
      }

      const seenMovies = await prisma.seenMovie.findMany({
        where: { userId, year },
        select: { movieId: true },
        orderBy: { createdAt: 'asc' },
      });

      res.json({ movieIds: seenMovies.map((entry) => entry.movieId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load seen movies';
      res.status(500).json({ error: message });
    }
  },
);

// Get seen movie counts for all users (superuser only)
router.get(
  '/seen-movies/:year/counts',
  authenticate,
  requireSuperuser,
  async (req: AuthRequest, res: Response) => {
    try {
      const { year } = req.params;
      if (!year) {
        res.status(400).json({ error: 'Year is required' });
        return;
      }

      const counts = await prisma.seenMovie.groupBy({
        by: ['userId'],
        where: { year },
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
  },
);

export default router;
