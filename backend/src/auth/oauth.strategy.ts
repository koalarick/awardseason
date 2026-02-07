import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth.service';
import type { SafeUser } from '../types/express';

const prisma = new PrismaClient();
const authService = new AuthService();
type OAuthSessionUser = SafeUser & { token?: string; isNewUser?: boolean; oauthProvider?: string };
type OAuthSessionEnvelope = { user: SafeUser; token?: string; isNewUser?: boolean; oauthProvider?: string };
type SerializedOAuthUser = OAuthSessionUser | OAuthSessionEnvelope;

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/oauth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          const { user, token, isNewUser } = await authService.findOrCreateOAuthUser(
            email,
            'google',
            profile.id,
          );

          // Passport expects User, but we need to store token too
          // Store it on the user object temporarily for the route handler
          const { passwordHash: _passwordHash, ...safeUser } = user;
          void _passwordHash;
          const sessionUser: OAuthSessionUser = {
            ...safeUser,
            token,
            isNewUser,
            oauthProvider: 'google',
          };
          return done(null, sessionUser);
        } catch (error) {
          return done(error, undefined);
        }
      },
    ),
  );
}

// Apple OAuth Strategy
// Note: Apple Sign In requires additional setup with @nicokaiser/passport-apple or custom implementation
// For now, Apple OAuth is not implemented - can be added later if needed
passport.serializeUser((user: SerializedOAuthUser, done) => {
  // Extract just the user ID for serialization (ignore token)
  const userId = 'user' in user ? user.user.id : user.id;
  done(null, userId);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user || undefined);
  } catch (error) {
    done(error, undefined);
  }
});
