import { PrismaClient } from '@prisma/client';
import { isDev } from './env';
import { logger } from './logger';

/**
 * A single shared Prisma client. In development we cache it on `globalThis`
 * so hot-reloads don't exhaust the connection pool.
 * On serverless (Vercel), delay connection until first use.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['warn', 'error'] : ['error'],
  });

if (isDev) globalForPrisma.prisma = prisma;

export async function connectDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('PostgreSQL connected');
    return true;
  } catch (err) {
    logger.error('PostgreSQL connection failed:', (err as Error).message);
    return false;
  }
}

export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
