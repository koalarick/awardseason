import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update user role (superuser only)
router.patch('/:userId/role', authenticate, requireSuperuser, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body as { role?: string };

    if (!role || !['USER', 'SUPERUSER'].includes(role)) {
      res.status(400).json({ error: 'Role must be USER or SUPERUSER' });
      return;
    }

    if (req.user?.id === userId && role !== 'SUPERUSER') {
      res.status(400).json({ error: 'You cannot remove your own superuser role' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
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
  } catch (error: any) {
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
