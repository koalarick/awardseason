import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient, User } from '@prisma/client';
import { JwtPayload } from '../types';
import { emailService } from '../services/email.service';
import { getFrontendUrl } from '../utils/frontend-url';

const prisma = new PrismaClient();
const JWT_SECRET_ENV = process.env.JWT_SECRET;
if (!JWT_SECRET_ENV) {
  throw new Error('JWT_SECRET environment variable is required');
}
// TypeScript assertion: we've checked it's not undefined above
const JWT_SECRET = JWT_SECRET_ENV as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 60);
const FRONTEND_URL = getFrontendUrl();

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  }

  async register(email: string, password: string): Promise<{ user: User; token: string }> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    // Auto-join global pool
    try {
      const currentYear = new Date().getFullYear().toString();
      const globalPool = await prisma.pool.findFirst({
        where: {
          name: `Global Oscars Pool ${currentYear}`,
          year: currentYear,
          isPublic: true,
        },
      });

      if (globalPool) {
        // Check if already a member before creating (avoid unique constraint violation)
        const existingMember = await prisma.poolMember.findUnique({
          where: {
            poolId_userId: {
              poolId: globalPool.id,
              userId: user.id,
            },
          },
        });

        if (!existingMember) {
          await prisma.poolMember.create({
            data: {
              poolId: globalPool.id,
              userId: user.id,
            },
          });
        }
      }
    } catch (error) {
      // Don't fail registration if auto-join fails
      console.error('Failed to auto-join global pool:', error);
    }

    // Generate token
    const token = this.generateToken(user);

    try {
      await emailService.sendWelcomeEmail(user.email);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
    const inboundEmail = process.env.INBOUND_EMAIL;
    if (inboundEmail && inboundEmail !== user.email) {
      try {
        await emailService.sendNewUserAlert(inboundEmail, user.email, 'password');
      } catch (error) {
        console.error('Failed to send superuser new user email:', error);
      }
    }

    return { user, token };
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user has password (OAuth users might not)
    if (!user.passwordHash) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValid = await this.comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = this.generateToken(user);

    return { user, token };
  }

  async findOrCreateOAuthUser(
    email: string,
    oauthProvider: string,
    oauthId: string,
  ): Promise<{ user: User; token: string }> {
    // Try to find existing user by email
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // Update OAuth info if not set
      if (!user.oauthProvider || !user.oauthId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            oauthProvider,
            oauthId,
          },
        });
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          oauthProvider,
          oauthId,
        },
      });

      // Auto-join global pool
      try {
        const currentYear = new Date().getFullYear().toString();
        const globalPool = await prisma.pool.findFirst({
          where: {
            name: `Global Oscars Pool ${currentYear}`,
            year: currentYear,
            isPublic: true,
          },
        });

        if (globalPool) {
          // Check if already a member before creating (avoid unique constraint violation)
          const existingMember = await prisma.poolMember.findUnique({
            where: {
              poolId_userId: {
                poolId: globalPool.id,
                userId: user.id,
              },
            },
          });

          if (!existingMember) {
            await prisma.poolMember.create({
              data: {
                poolId: globalPool.id,
                userId: user.id,
              },
            });
          }
        }
      } catch (error) {
        // Don't fail OAuth if auto-join fails
        console.error('Failed to auto-join global pool:', error);
      }

      try {
        await emailService.sendWelcomeEmail(user.email);
      } catch (error) {
        console.error('Failed to send welcome email:', error);
      }

      const inboundEmail = process.env.INBOUND_EMAIL;
      if (inboundEmail && inboundEmail !== user.email) {
        try {
          await emailService.sendNewUserAlert(inboundEmail, user.email, oauthProvider);
        } catch (error) {
          console.error('Failed to send superuser new user email:', error);
        }
      }
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  private hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;
    await emailService.sendPasswordResetEmail(user.email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashResetToken(token);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await this.hashPassword(newPassword);

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await prisma.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
