import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Redis client — sessions, cart storage, response caching, rate limiting.
 * `lazyConnect` lets the server boot even if Redis is temporarily down;
 * callers should tolerate a null-ish cache and fall back to the database.
 */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error:', err.message));

export async function connectRedis(): Promise<boolean> {
  try {
    await redis.connect();
    return true;
  } catch (err) {
    logger.error('Redis connection failed:', (err as Error).message);
    return false;
  }
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}
