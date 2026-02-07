import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import './auth/oauth.strategy'; // Initialize OAuth strategies

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const CORS_ORIGINS = CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        // Allow non-browser or same-origin server requests (no Origin header)
        console.log('CORS: Allowing request with no origin header');
        return callback(null, true);
      }

      // Allow localhost and local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      const isLocalhost =
        origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
      // Match local network IPs: http://192.168.x.x:port, http://10.x.x.x:port, http://172.16-31.x.x:port
      const isLocalNetwork =
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.') ||
        /^http:\/\/172\.(1[6-9]|2[0-9]|3[01])\./.test(origin);

      // Allow if it matches configured origins, localhost, or local network
      if (CORS_ORIGINS.includes(origin) || isLocalhost || isLocalNetwork) {
        console.log(`CORS: Allowing origin: ${origin}`);
        callback(null, true);
      } else {
        console.log(`CORS: Blocking origin: ${origin} (CORS_ORIGIN=${CORS_ORIGIN})`);
        callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
      }
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
import authRoutes from './routes/auth.routes';
import poolsRoutes from './routes/pools.routes';
import oddsRoutes from './routes/odds.routes';
import nomineesRoutes from './routes/nominees.routes';
app.use('/api/auth', authRoutes);
app.use('/api/pools', poolsRoutes);
app.use('/api/odds', oddsRoutes);
app.use('/api/nominees', nomineesRoutes);
import predictionsRoutes from './routes/predictions.routes';
app.use('/api/predictions', predictionsRoutes);
import usersRoutes from './routes/users.routes';
app.use('/api/users', usersRoutes);
import winnersRoutes from './routes/winners.routes';
import settingsRoutes from './routes/settings.routes';
import scoresRoutes from './routes/scores.routes';
import emailRoutes from './routes/email.routes';
import seenMoviesRoutes from './routes/seen-movies.routes';
app.use('/api/winners', winnersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/seen-movies', seenMoviesRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start cron jobs
import { startOddsSnapshotJob } from './jobs/odds-snapshot.job';
// Market resolution job disabled - winners are manually entered
// import { startMarketResolutionJob } from './jobs/market-resolution.job';

// Wrap in try-catch to prevent server crash if cron jobs fail to initialize
try {
  startOddsSnapshotJob();
  // startMarketResolutionJob(); // Disabled - using manual winner entry only
} catch (error) {
  console.error('Error starting cron jobs:', error);
  // Continue server startup even if cron jobs fail
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await prisma.$disconnect();
    process.exit(0);
  });
});

export { app, prisma };
