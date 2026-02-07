import { Router, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { logEvent } from '../services/event.service';
import {
  AuthRequest,
  authenticate,
  authenticateOptional,
  requireSuperuser,
} from '../middleware/auth.middleware';
import { getDeviceType } from '../utils/device-type';

const router = Router();
const prisma = new PrismaClient();

const parseLimit = (value: unknown, fallback: number) => {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const parseList = (value: unknown) => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const parseDate = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parseBoolean = (value: unknown) => {
  if (typeof value !== 'string') return false;
  return value.toLowerCase() === 'true' || value === '1';
};

const buildPageViewFilter = (value: string) => {
  const pathExpr = Prisma.sql`split_part(e.metadata->>'path','?',1)`;
  const [type, scope] = value.split(':');

  let base: Prisma.Sql | null = null;

  switch (type) {
    case 'homepage':
      base = Prisma.sql`${pathExpr} = '/'`;
      break;
    case 'login':
      base = Prisma.sql`${pathExpr} = '/login'`;
      break;
    case 'register':
      base = Prisma.sql`${pathExpr} = '/register'`;
      break;
    case 'forgot-password':
      base = Prisma.sql`${pathExpr} = '/forgot-password'`;
      break;
    case 'reset-password':
      base = Prisma.sql`${pathExpr} = '/reset-password'`;
      break;
    case 'oauth-callback':
      base = Prisma.sql`${pathExpr} = '/auth/callback'`;
      break;
    case 'events':
      base = Prisma.sql`${pathExpr} = '/events'`;
      break;
    case 'users':
      base = Prisma.sql`${pathExpr} = '/users'`;
      break;
    case 'checklist':
      base = Prisma.sql`${pathExpr} = '/movies/seen'`;
      break;
    case 'ballot':
      base = Prisma.sql`${pathExpr} ~ '^/pool/[^/]+/edit$'`;
      break;
    case 'pool-invite':
      base = Prisma.sql`${pathExpr} ~ '^/pool/[^/]+/invite$'`;
      break;
    case 'pool':
      base = Prisma.sql`${pathExpr} ~ '^/pool/[^/]+$'`;
      break;
    case 'global-winners':
      base = Prisma.sql`${pathExpr} = '/winners/global'`;
      break;
    case 'nominee-metadata':
      base = Prisma.sql`${pathExpr} = '/nominees/metadata'`;
      break;
    case 'nominees':
      base = Prisma.sql`${pathExpr} ~ '^/nominees/\\d{4}$'`;
      break;
    default:
      base = null;
  }

  if (!base) {
    return Prisma.sql`FALSE`;
  }

    if (scope) {
      return Prisma.sql`(${base} AND e.metadata->>'viewScope' = ${scope})`;
    }

  return base;
};

router.get('/event-names', authenticate, requireSuperuser, async (_req, res: Response) => {
  try {
    const rows = await prisma.$queryRaw<Array<{ event_name: string }>>(
      Prisma.sql`SELECT DISTINCT event_name FROM events ORDER BY event_name ASC`,
    );
    res.json(rows.map((row) => row.event_name));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load event names' });
  }
});

router.get('/', authenticate, requireSuperuser, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseLimit(req.query.limit, 200), 500);
    const before = parseDate(req.query.before);
    const start = parseDate(req.query.start);
    const end = parseDate(req.query.end);
    const eventName = typeof req.query.eventName === 'string' ? req.query.eventName.trim() : '';
    const eventNames = parseList(req.query.eventNames);
    const pageViews = parseList(req.query.pageViews);
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    const excludeSuperuser = parseBoolean(req.query.excludeSuperuser);
    const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
    const poolId = typeof req.query.poolId === 'string' ? req.query.poolId.trim() : '';
    const requestId =
      typeof req.query.requestId === 'string' ? req.query.requestId.trim() : '';

    const conditions: Prisma.Sql[] = [];
    const eventFilters: Prisma.Sql[] = [];

    if (eventNames.length > 0) {
      eventFilters.push(Prisma.sql`e.event_name IN (${Prisma.join(eventNames)})`);
    } else if (eventName) {
      eventFilters.push(Prisma.sql`e.event_name = ${eventName}`);
    }

    if (pageViews.length > 0) {
      const pageFilters = pageViews.map((value) => buildPageViewFilter(value));
      eventFilters.push(
        Prisma.sql`(e.event_name = 'page.view' AND (${Prisma.join(pageFilters, ' OR ')}))`,
      );
    }

    if (eventFilters.length > 0) {
      conditions.push(Prisma.sql`(${Prisma.join(eventFilters, ' OR ')})`);
    }
    if (email) {
      conditions.push(Prisma.sql`u.email ILIKE ${`%${email}%`}`);
    }
    if (excludeSuperuser) {
      conditions.push(Prisma.sql`(e.user_id IS NULL OR u.role <> 'SUPERUSER')`);
    }
    if (userId) {
      conditions.push(Prisma.sql`e.user_id = ${userId}`);
    }
    if (poolId) {
      conditions.push(Prisma.sql`e.pool_id = ${poolId}`);
    }
    if (requestId) {
      conditions.push(Prisma.sql`e.request_id = ${requestId}`);
    }
    if (before) {
      conditions.push(Prisma.sql`e.created_at < ${before}`);
    }
    if (start) {
      conditions.push(Prisma.sql`e.created_at >= ${start}`);
    }
    if (end) {
      conditions.push(Prisma.sql`e.created_at <= ${end}`);
    }

    const whereClause =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        event_name: string;
        created_at: Date;
        user_id: string | null;
        user_email: string | null;
        pool_id: string | null;
        pool_name: string | null;
        request_id: string | null;
        ip: string | null;
        user_agent: string | null;
        device_type: string | null;
        metadata: Record<string, unknown>;
      }>
    >(Prisma.sql`
      SELECT
        e.id,
        e.event_name,
        e.created_at,
        e.user_id,
        u.email AS user_email,
        e.pool_id,
        p.name AS pool_name,
        e.request_id,
        e.ip,
        e.user_agent,
        e.device_type,
        e.metadata
      FROM events e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN pools p ON p.id = e.pool_id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ${limit + 1}
    `);

    const hasMore = rows.length > limit;
    const events = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
      id: row.id,
      eventName: row.event_name,
      createdAt: row.created_at,
      userEmail: row.user_email,
      deviceType: row.device_type,
      metadata: {
        ...(row.metadata ?? {}),
        userId: row.user_id ?? null,
        poolId: row.pool_id ?? null,
        poolName: row.pool_name ?? null,
        requestId: row.request_id ?? null,
        ip: row.ip ?? null,
        userAgent: row.user_agent ?? null,
      },
    }));

    res.json({ events, hasMore });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load events' });
  }
});

router.post('/page-view', authenticateOptional, async (req: AuthRequest, res: Response) => {
  try {
    const {
      path,
      title,
      referrer,
      screen,
      deviceType: deviceTypeOverride,
      viewScope: viewScopeParam,
      targetUserId: targetUserIdParam,
    } = req.body || {};

    if (!path || typeof path !== 'string') {
      res.status(400).json({ error: 'path is required' });
      return;
    }

    const userAgent = req.userAgent ?? null;
    const deviceType =
      typeof deviceTypeOverride === 'string' && deviceTypeOverride.trim()
        ? deviceTypeOverride
        : getDeviceType(userAgent);

    const parsePath = (rawPath: string) => {
      try {
        const url = new URL(rawPath, 'http://localhost');
        return {
          pathname: url.pathname,
          searchParams: url.searchParams,
        };
      } catch {
        const [pathnameRaw, query] = rawPath.split('?');
        return {
          pathname: pathnameRaw || rawPath,
          searchParams: new URLSearchParams(query || ''),
        };
      }
    };

    const { pathname, searchParams } = parsePath(path);
    const normalizedPath = pathname.replace(/\/+$/, '') || '/';

    const targetUserId =
      typeof targetUserIdParam === 'string' && targetUserIdParam.trim()
        ? targetUserIdParam.trim()
        : searchParams.get('userId') || undefined;

    let viewScope =
      typeof viewScopeParam === 'string' && viewScopeParam.trim()
        ? viewScopeParam.trim()
        : undefined;

    const poolMatch = normalizedPath.match(/^\/pool\/([^/]+)(?:\/|$)/);
    const poolIdFromPath = poolMatch?.[1];
    const isBallotView = /^\/pool\/[^/]+\/edit$/.test(normalizedPath);
    const isChecklistView = normalizedPath === '/movies/seen';
    if (!viewScope && (isBallotView || isChecklistView)) {
      if (targetUserId) {
        if (!req.user?.id) {
          viewScope = 'unknown';
        } else {
          viewScope = targetUserId === req.user.id ? 'self' : 'other';
        }
      } else {
        viewScope = 'self';
      }
    }

    void logEvent({
      eventName: 'page.view',
      userId: req.user?.id,
      poolId: poolIdFromPath,
      requestId: req.requestId,
      ip: req.clientIp,
      userAgent,
      deviceType,
      metadata: {
        path,
        title: typeof title === 'string' ? title : undefined,
        referrer: typeof referrer === 'string' ? referrer : undefined,
        screen: typeof screen === 'object' && screen ? screen : undefined,
        viewScope,
        targetUserId,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to log page view' });
  }
});

export default router;
