import { app } from './app';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { connectDatabase } from '@/config/database';
import { connectRedis, redis } from '@/config/redis';
import { prisma } from '@/config/database';

async function main() {
  // Connect datastores, but don't crash the API if they're temporarily down —
  // /api/health stays up and reports readiness.
  await connectDatabase();
  await connectRedis().catch(() => undefined);

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on http://localhost:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down.`);
    server.close();
    await prisma.$disconnect().catch(() => undefined);
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
