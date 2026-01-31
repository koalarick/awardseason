import { Response, NextFunction } from 'express';
import { AuthRequest, JwtPayload } from '../types';
import { AuthService } from '../auth/auth.service';
import { PrismaClient } from '@prisma/client';
import { SafeUser } from '../types/express';

// Re-export AuthRequest for convenience
export type { AuthRequest };

const prisma = new PrismaClient();
const authService = new AuthService();

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = authService.verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        oauthProvider: true,
        oauthId: true,
        createdAt: true,
        updatedAt: true,
        // Explicitly exclude passwordHash for security
      },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Type assertion: we've selected all SafeUser fields (excluding passwordHash)
    req.user = user as SafeUser;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireSuperuser = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'SUPERUSER') {
    res.status(403).json({ error: 'Superuser access required' });
    return;
  }
  next();
};
