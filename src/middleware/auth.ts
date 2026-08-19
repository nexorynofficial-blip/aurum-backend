import { NextFunction, Request, Response } from 'express';
import { verifyJWT } from '@/utils/jwt';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/apiError';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req.cookies as Record<string, string> | undefined)?.authToken;
  return cookie ?? null;
}

async function resolveUser(token: string) {
  const payload = verifyJWT(token);
  if (payload.type === 'reset') return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
}

/** Require a valid session; 401 otherwise. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Authentication required');
    const user = await resolveUser(token);
    if (!user) throw ApiError.unauthorized('Invalid or expired session');
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(ApiError.unauthorized('Invalid or expired session'));
  }
}

/** Attach the user when present, but never block the request. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (token) req.user = (await resolveUser(token)) ?? undefined;
  } catch {
    /* ignore — treat as guest */
  }
  next();
}

/** Require an authenticated admin. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (req.user?.role !== 'ADMIN') return next(ApiError.forbidden('Admin access required'));
    next();
  });
}
