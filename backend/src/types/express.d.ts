/// <reference types="@types/passport" />

import { User as PrismaUser } from '@prisma/client';

// User type without passwordHash for security
export type SafeUser = Omit<PrismaUser, 'passwordHash'>;

declare global {
  namespace Express {
    // Override Express's User type with SafeUser (no passwordHash)
    interface User extends SafeUser {}

    interface Request {
      user?: SafeUser;
    }
  }
}

export {};
