# Academy Awards Pool

A full-stack web application for creating and managing Oscar prediction pools with friends. Features real-time odds from Kalshi, automatic winner detection, and dynamic scoring based on prediction odds.

## Features

### Core Functionality
- **User Authentication**: Email/password and OAuth (Google/Apple) support with JWT tokens
- **Pool Management**: Create pools, join with password or public access, manage members
- **Predictions**: Make predictions across all Oscar categories with real-time odds display
- **Automatic Scoring**: Scores calculated based on odds at prediction time with configurable multipliers
- **Odds Multiplier**: Reward risk-taking with configurable multiplier formulas (linear, inverse, sqrt, log)
- **Auto Winner Detection**: Automatically detects winners from Kalshi markets via cron jobs
- **Leaderboards**: Real-time score tracking and rankings with detailed breakdowns
- **Paid Pools**: Support for entry fees and payout structures
- **Global Pool**: Shared winners across all pools for a given year

### Advanced Features
- **Odds Snapshots**: Historical odds tracking for accurate scoring
- **Custom Scoring**: Per-category point values and configurable odds multipliers
- **Payout Structures**: Configurable payout percentages for different positions
- **Submission Names**: Optional anonymous or custom names for pool members
- **Payment Tracking**: Track payment status for paid pools

## Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Authentication**: JWT, Passport.js (Google/Apple OAuth)
- **Cron Jobs**: node-cron
- **Validation**: Zod

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **State Management**: TanStack React Query

### Infrastructure
- **Containerization**: Docker, Docker Compose
- **Web Server**: Nginx (production frontend)
- **External APIs**: Kalshi Elections API (via CORS proxies)

## Data & Assets

- `nominees.json` (repo root) drives category/nominee data used for seeding and updates.
- `frontend/public/images/` contains nominee and film artwork used across the UI.

## Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose (recommended)
- PostgreSQL 16+ (or use Docker)
- Kalshi API access (for odds data)

## Project Structure

```
academyawardspool/
├── backend/
│   ├── src/
│   │   ├── auth/              # Authentication logic
│   │   ├── jobs/              # Cron jobs (odds snapshots, market resolution)
│   │   ├── middleware/        # Auth middleware
│   │   ├── routes/            # API route handlers
│   │   ├── services/          # Business logic services
│   │   ├── scripts/           # Utility scripts
│   │   └── server.ts          # Express server entry point
│   ├── prisma/
│   │   ├── migrations/        # Database migrations
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.ts            # Database seeding
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── context/          # React context providers
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   ├── services/         # API service layer
│   │   └── main.tsx          # React entry point
│   └── package.json
├── docker-compose.yml         # Docker Compose configuration
└── README.md
```

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd academyawardspool
```

### 2. Environment Variables

Use `.env.example` as a template for your root `.env`, and create `.env` files in `backend/` and `frontend/` directories:

**backend/.env:**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/academyawardspool?schema=public"
JWT_SECRET="your-secret-key-here-change-in-production"
NODE_ENV="development"
PORT=3001
CORS_ORIGIN="http://localhost:5173"

# OAuth (optional - only needed if using OAuth)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
APPLE_CLIENT_ID="your-apple-client-id"
APPLE_TEAM_ID="your-apple-team-id"
APPLE_KEY_ID="your-apple-key-id"
APPLE_PRIVATE_KEY="your-apple-private-key"

# Superuser (optional - for admin access)
SUPERUSER_EMAIL="admin@example.com"
SUPERUSER_PASSWORD="admin123"

# SendGrid (optional - for transactional email)
SENDGRID_API_KEY="your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="verified-sender@yourdomain.com"
SENDGRID_FROM_NAME="Academy Awards Pool"
INBOUND_EMAIL="alerts@yourdomain.com"
```

**frontend/.env:**
```env
VITE_API_URL=http://localhost:3001
```

**Root `.env` (for Docker Compose):**
```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=academyawardspool
JWT_SECRET=your-secret-key-here
CORS_ORIGIN=http://localhost:5173
LOCAL_IP=http://localhost:3001
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=verified-sender@yourdomain.com
SENDGRID_FROM_NAME=Academy Awards Pool
INBOUND_EMAIL=alerts@yourdomain.com
```

### 3. Database Setup

#### Option A: Using Docker Compose (Recommended)

```bash
# Start PostgreSQL
docker-compose up -d postgres

# Wait for database to be ready, then run migrations
cd backend
npx prisma migrate dev
npx prisma generate
npm run prisma:seed
```

#### Option B: Local PostgreSQL

```bash
# Create database
createdb academyawardspool

# Run migrations
cd backend
npx prisma migrate dev
npx prisma generate
npm run prisma:seed
```

### 4. Running the Application

#### Option A: Docker Compose (Full Stack)

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

This will start:
- PostgreSQL on port 5432
- Backend API on port 3001
- Frontend on port 5173

#### Option B: Local Development

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173

## Quality Scripts

**Frontend:**
```bash
cd frontend
npm run lint
npm run format
npm run format:check
```

**Backend:**
```bash
cd backend
npm run lint
npm run format
npm run format:check
```

## Utility Scripts

Update nominee metadata from `nominees.json`:
```bash
cd backend
npm run prisma:update-nominee-info -- --year 2026
```
- Backend API: http://localhost:3001

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user with email/password
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current authenticated user
- `GET /api/auth/oauth/google` - Initiate Google OAuth flow
- `GET /api/auth/oauth/apple` - Initiate Apple OAuth flow

### Pools
- `POST /api/pools` - Create a new pool
- `GET /api/pools/my-pools` - Get all pools for current user
- `GET /api/pools/:poolId` - Get pool details
- `POST /api/pools/:poolId/join` - Join a pool (with password if required)
- `GET /api/pools/:poolId/members` - Get pool members list

### Predictions
- `POST /api/predictions` - Create or update a prediction
- `GET /api/predictions/pool/:poolId` - Get current user's predictions for a pool
- `GET /api/predictions/pool/:poolId/all` - Get all predictions for a pool (for leaderboard)

### Winners
- `POST /api/winners` - Enter winner manually (pool owner only)
- `GET /api/winners/pool/:poolId` - Get winners for a pool
- `GET /api/winners/global/:year` - Get global winners for a year

### Scores
- `GET /api/scores/pool/:poolId` - Get leaderboard for a pool
- `GET /api/scores/pool/:poolId/user/:userId` - Get detailed score breakdown for a user

### Settings
- `GET /api/settings/:poolId` - Get pool settings
- `PUT /api/settings/:poolId` - Update pool settings (owner only)

### Odds
- `GET /api/odds/category/:categoryId` - Get current odds for all nominees in a category
- `GET /api/odds/:categoryId/:nomineeId` - Get current odds for a specific nominee
- `POST /api/odds/:categoryId/:nomineeId/at-time` - Get odds at a specific timestamp

### Nominees
- `GET /api/nominees/:year` - Get all categories and nominees for a year
- `PATCH /api/nominees/:year/:categoryId/:nomineeId` - Update nominee metadata (superuser only)

### Users
- `GET /api/users` - Get all users (superuser only)

### Email
- `POST /api/email/test` - Send a test email (superuser only)

## Scoring System

### How Scoring Works

1. **Base Points**: Each category has a default point value (configurable per pool)
2. **Odds Multiplier**: When a prediction is correct, points are multiplied based on:
   - The odds percentage at the time of prediction
   - The selected multiplier formula (linear, inverse, sqrt, log)
3. **Final Score**: `basePoints × multiplier` for each correct prediction

### Multiplier Formulas

- **Linear** (default): `2 - (odds / 100)`
  - Example: 20% odds → 1.8x multiplier
- **Inverse**: `100 / odds`
  - Example: 20% odds → 5x multiplier
- **Square Root**: `1 + sqrt(1 - odds/100)`
  - Example: 20% odds → 1.89x multiplier
- **Logarithmic**: `1 + log(100 / odds)`
  - Example: 20% odds → 2.61x multiplier

### Global Winners

All pools for a given year share the same set of winners (stored in a "Global Oscars Pool"). This ensures consistency across all pools and simplifies winner management.

## Cron Jobs

The backend includes two automated cron jobs:

### 1. Odds Snapshot Job
- **Schedule**: Runs every hour at minute 0
- **Purpose**: Fetches current odds from Kalshi API and stores snapshots
- **Location**: `backend/src/jobs/odds-snapshot.job.ts`
- **Data**: Stored in `OddsSnapshot` table for historical tracking

### 2. Market Resolution Job
- **Schedule**: Runs every 5 minutes
- **Purpose**: Checks Kalshi markets for resolved categories and automatically updates winners
- **Location**: `backend/src/jobs/market-resolution.job.ts`
- **Behavior**: Only updates if winner not already set manually

Both jobs are automatically started when the backend server starts.

## Development

### Backend Commands

```bash
cd backend

# Development
npm run dev              # Start dev server with hot reload

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio (database GUI)
npm run prisma:seed      # Seed database with initial data

# Production
npm run build           # Build TypeScript
npm start               # Run production build
```

### Frontend Commands

```bash
cd frontend

# Development
npm run dev             # Start dev server
npm run lint            # Run ESLint

# Production
npm run build           # Build for production
npm run preview         # Preview production build
```

### Database Management

```bash
# Open Prisma Studio (visual database editor)
cd backend
npm run prisma:studio

# Create a new migration
npx prisma migrate dev --name your_migration_name

# Reset database (development only - deletes all data)
npx prisma migrate reset
```

## Data Seeding

The seed script (`backend/prisma/seed.ts`) populates the database with:
- Oscar categories for the current year
- Nominees for each category
- A global pool for the year

Run seeding with:
```bash
cd backend
npm run prisma:seed
```

## Kalshi Integration

The application integrates with Kalshi Elections API to fetch real-time odds for Oscar markets. The integration includes:

- **CORS Proxy Support**: Uses multiple proxy services to handle CORS restrictions
- **Market Matching**: Intelligent matching of nominees to Kalshi markets using multiple strategies
- **Error Handling**: Graceful fallbacks when markets are unavailable
- **Historical Tracking**: Stores odds snapshots for accurate scoring

### Category Mapping

Oscar categories are mapped to Kalshi event tickers (e.g., `best-picture` → `KXOSCARPIC-26`). See `backend/src/services/kalshi.service.ts` for the full mapping.

## Production Deployment

### Environment Variables

Ensure all production environment variables are set:
- Strong `JWT_SECRET`
- Production `DATABASE_URL`
- Correct `CORS_ORIGIN` for your frontend domain
- OAuth credentials if using OAuth

### Docker Production Build

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Run production containers
docker-compose -f docker-compose.prod.yml up -d
```

### Database Migrations (Production)

```bash
cd backend
npx prisma migrate deploy
```

**Important**: Always backup your database before running migrations in production.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Support

For issues, questions, or contributions, please open an issue on GitHub.
