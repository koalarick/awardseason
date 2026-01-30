import { Request, Response } from 'express';
import { AuthService } from './auth.service';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      // Validate password length
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long' });
        return;
      }

      const { user, token } = await authService.register(email, password);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      // Handle Prisma unique constraint violation
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'User with this email already exists' });
        return;
      }
      res.status(400).json({ error: error.message || 'Registration failed' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const { user, token } = await authService.login(email, password);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        token,
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }

  async getMe(req: Request, res: Response): Promise<void> {
    try {
      // This endpoint requires authentication middleware
      const user = (req as any).user;
      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
