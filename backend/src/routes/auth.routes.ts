import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../auth/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { getFrontendUrl } from '../utils/frontend-url';
import type { SafeUser } from '../types/express';
import { logEvent } from '../services/event.service';

const router = Router();
const authController = new AuthController();
type OAuthSessionUser = SafeUser & { token: string; isNewUser?: boolean; oauthProvider?: string };

// Email/password routes
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/forgot-password', authController.forgotPassword.bind(authController));
router.post('/reset-password', authController.resetPassword.bind(authController));
router.get('/me', authenticate, authController.getMe.bind(authController));

// OAuth callback token endpoint - get token from cookie
router.get('/oauth/token', (req, res) => {
  const token = req.cookies.token;
  if (token) {
    res.json({ token });
  } else {
    res.status(401).json({ error: 'No token found' });
  }
});

// Google OAuth routes
router.get('/oauth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/oauth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const sessionUser = req.user as OAuthSessionUser | undefined;
    const token = sessionUser?.token;
    if (!token) {
      res.status(401).json({ error: 'No token found in OAuth session' });
      return;
    }
    const frontendUrl = getFrontendUrl();

    // Set token in httpOnly cookie instead of URL
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
      sameSite: 'lax', // Protection against CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    if (sessionUser?.id) {
      const eventName = sessionUser.isNewUser ? 'user.registered' : 'user.logged_in';
      void logEvent({
        eventName,
        userId: sessionUser.id,
        requestId: req.requestId,
        ip: req.clientIp,
        userAgent: req.userAgent,
        deviceType: req.deviceType,
        metadata: {
          method: 'oauth',
          provider: sessionUser.oauthProvider || 'google',
        },
      });
    }

    // Redirect to frontend without token in URL
    res.redirect(`${frontendUrl}/auth/callback`);
  },
);

// Apple OAuth routes
// Note: Apple Sign In requires additional setup - can be implemented later
router.get('/oauth/apple', (req, res) => {
  res
    .status(501)
    .json({ error: 'Apple OAuth not yet implemented. Use Google OAuth or email/password.' });
});

export default router;
