export function validateEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8;
}

/** Coerce a Prisma Decimal / string / number into a plain JS number. */
export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}
