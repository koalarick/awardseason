import { Request } from 'express';
import { User as PrismaUser } from '@prisma/client';

// AuthRequest is now just an alias since we've augmented Express.Request globally
export type AuthRequest = Request;

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}
