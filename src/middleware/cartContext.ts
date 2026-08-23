import { NextFunction, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { isProd } from '../config/env';

const COOKIE = 'aurumCartId';

/**
 * Ensures every request has a stable anonymous cart id. Authenticated users
 * key their cart by user id instead (see cartService.cartKey).
 */
export function cartContext(req: Request, res: Response, next: NextFunction) {
  const existing = (req.cookies as Record<string, string> | undefined)?.[COOKIE];
  const id = existing ?? uuid();
  req.cartId = id;
  if (!existing) {
    res.cookie(COOKIE, id, {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as const,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }
  next();
}
