import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { env, isProd } from '../config/env';
import { generateJWT, verifyJWT } from '../utils/jwt';
import { ApiError } from '../utils/apiError';
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from '../services/emailService';
import { saveUserSession, clearUserSession } from '../services/sessionService';

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  // Frontend and backend live on different Vercel domains, so the auth
  // cookie is cross-site — 'lax' is dropped on cross-site fetch/XHR.
  sameSite: (isProd ? 'none' : 'lax') as const,
  maxAge: env.JWT_EXPIRY * 24 * 60 * 60 * 1000,
};

function publicUser(u: { id: string; email: string; firstName: string; lastName: string; role: string }) {
  return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role };
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  const { email, password, firstName, lastName } = registerSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('Email already registered');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName },
  });

  const token = generateJWT({ userId: user.id, email: user.email, role: user.role });
  await saveUserSession(user.id, token).catch(() => undefined);
  await sendWelcomeEmail(user.email, user.firstName);

  res.cookie('authToken', token, cookieOptions);
  res.status(201).json({ user: publicUser(user), token });
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw ApiError.unauthorized('Invalid credentials');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid credentials');

  const token = generateJWT({ userId: user.id, email: user.email, role: user.role });
  await saveUserSession(user.id, token).catch(() => undefined);

  res.cookie('authToken', token, cookieOptions);
  res.json({ user: publicUser(user), token });
}

export async function logout(req: Request, res: Response) {
  if (req.user?.id) await clearUserSession(req.user.id).catch(() => undefined);
  res.clearCookie('authToken', { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax' });
  res.json({ message: 'Logged out' });
}

export async function me(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  res.json({ user: req.user });
}

const forgotSchema = z.object({ email: z.string().email() });

export async function requestPasswordReset(req: Request, res: Response) {
  const { email } = forgotSchema.parse(req.body);
  const generic = { message: 'If that email exists, a reset link has been sent.' };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json(generic); // do not reveal existence

  const resetToken = generateJWT({ userId: user.id, type: 'reset' }, '1h');
  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000) },
  });
  await sendPasswordResetEmail(email, resetToken);

  res.json(generic);
}

const resetSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = resetSchema.parse(req.body);

  let payload;
  try {
    payload = verifyJWT(token);
  } catch {
    throw ApiError.badRequest('Invalid or expired reset token');
  }
  if (payload.type !== 'reset') throw ApiError.badRequest('Invalid reset token');

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.resetToken !== token || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpires: null },
  });

  res.json({ message: 'Password updated. You can now sign in.' });
}
