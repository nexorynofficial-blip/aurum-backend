import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  email?: string;
  role?: string;
  type?: 'access' | 'reset';
}

export function generateJWT(
  payload: JwtPayload,
  expiresIn: string | number = `${env.JWT_EXPIRY}d`
): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyJWT(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
