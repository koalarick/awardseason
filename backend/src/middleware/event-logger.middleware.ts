import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logEvent } from '../services/event.service';
import { getDeviceType } from '../utils/device-type';

const getClientIp = (req: Request): string | null => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0]?.trim();

  return forwardedIp || req.ip || null;
};

export const eventLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  const incomingRequestId = req.headers['x-request-id'];
  const requestId =
    (typeof incomingRequestId === 'string' && incomingRequestId.trim()) || crypto.randomUUID();

  const userAgentHeader = req.headers['user-agent'];
  const userAgent = typeof userAgentHeader === 'string' ? userAgentHeader : null;
  const clientIp = getClientIp(req);
  const deviceType = getDeviceType(userAgent);

  req.requestId = requestId;
  req.clientIp = clientIp ?? undefined;
  req.userAgent = userAgent ?? undefined;
  req.deviceType = deviceType;

  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    if (req.method === 'OPTIONS') {
      return;
    }

    if (!req.path.startsWith('/api')) {
      return;
    }

    const durationMs = Date.now() - start;
    const path = req.originalUrl.split('?')[0];

    void logEvent({
      eventName: 'api.request',
      userId: req.user?.id,
      requestId,
      ip: clientIp,
      userAgent,
      deviceType,
      metadata: {
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs,
      },
    });
  });

  next();
};
