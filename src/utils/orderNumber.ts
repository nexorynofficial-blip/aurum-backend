import { prisma } from '../config/database';

/**
 * Generate the next sequential order number, e.g. "AU-2026-00042".
 * Uses the current year and the running order count for that year.
 */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const count = await prisma.order.count({ where: { createdAt: { gte: startOfYear } } });
  const seq = String(count + 1).padStart(5, '0');
  return `AU-${year}-${seq}`;
}
