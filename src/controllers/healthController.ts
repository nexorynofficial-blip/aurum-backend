import { Request, Response } from 'express';
import { isDatabaseHealthy } from '@/config/database';
import { isRedisHealthy } from '@/config/redis';

/** Liveness probe. */
export function health(_req: Request, res: Response) {
  res.json({ status: 'ok' });
}

/** Readiness probe — verifies datastore connectivity. */
export async function healthDetailed(_req: Request, res: Response) {
  const [db, cache] = await Promise.all([isDatabaseHealthy(), isRedisHealthy()]);
  const ok = db && cache;
  res.status(ok ? 200 : 503).json({
    database: db ? 'connected' : 'disconnected',
    redis: cache ? 'connected' : 'disconnected',
  });
}
