import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type EventLogInput = {
  eventName: string;
  userId?: string | null;
  poolId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const logEvent = async (input: EventLogInput): Promise<void> => {
  try {
    const metadata = {
      ...(input.metadata ?? {}),
      userId: input.userId ?? null,
      poolId: input.poolId ?? null,
      requestId: input.requestId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    };

    await prisma.$executeRaw`
      INSERT INTO events (
        id,
        event_name,
        user_id,
        pool_id,
        request_id,
        ip,
        user_agent,
        device_type,
        metadata
      )
      VALUES (
        ${crypto.randomUUID()},
        ${input.eventName},
        ${input.userId ?? null},
        ${input.poolId ?? null},
        ${input.requestId ?? null},
        ${input.ip ?? null},
        ${input.userAgent ?? null},
        ${input.deviceType ?? null},
        ${JSON.stringify(metadata)}::jsonb
      )
    `;
  } catch (error) {
    console.error('Failed to log event:', error);
  }
};
