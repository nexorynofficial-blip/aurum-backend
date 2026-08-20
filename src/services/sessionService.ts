import { redis } from '../config/redis';
import { env } from '../config/env';

const ttlSeconds = env.JWT_EXPIRY * 24 * 60 * 60;

export async function saveUserSession(userId: string, token: string) {
  await redis.setex(`session:${userId}`, ttlSeconds, token);
}

export async function getUserSession(userId: string) {
  return redis.get(`session:${userId}`);
}

export async function clearUserSession(userId: string) {
  await redis.del(`session:${userId}`);
}

/** Simple Redis-backed sliding-window rate check (used for password resets). */
export async function checkRateLimit(key: string, limit = 5, windowSeconds = 3600) {
  const redisKey = `ratelimit:${key}`;
  const count = await redis.incr(redisKey);
  if (count === 1) await redis.expire(redisKey, windowSeconds);
  return count <= limit;
}
