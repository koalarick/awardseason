import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../auth/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

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
    const { user, token } = req.user as any;
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';

    // Set token in httpOnly cookie instead of URL
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
      sameSite: 'lax', // Protection against CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

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
