import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireSuperuser, AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();
const router = Router();

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

export default router;
