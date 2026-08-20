import { Request } from 'express';
import { redis } from '../config/redis';
import { prisma } from '../config/database';
import { computeTotals } from '../utils/pricing';
import { toNumber } from '../utils/validators';
import { ApiError } from '../utils/apiError';

const TTL = 30 * 24 * 60 * 60; // 30 days

export interface StoredLine {
  id: string; // productId + variant signature
  productId: string;
  quantity: number;
  variant?: Record<string, string>;
}

/** Cart is keyed by user id when authenticated, otherwise the guest cart cookie. */
export function cartKey(req: Request): string {
  const owner = req.user?.id ? `user:${req.user.id}` : `guest:${req.cartId}`;
  return `cart:${owner}`;
}

function lineId(productId: string, variant?: Record<string, string>): string {
  const sig = variant
    ? Object.keys(variant)
        .sort()
        .map((k) => `${k}=${variant[k]}`)
        .join('&')
    : '';
  return sig ? `${productId}::${sig}` : productId;
}

async function read(key: string): Promise<StoredLine[]> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as StoredLine[]) : [];
}

async function write(key: string, lines: StoredLine[]) {
  await redis.setex(key, TTL, JSON.stringify(lines));
}

/** Hydrate stored lines with live product data and compute totals. */
export async function hydrateCart(lines: StoredLine[]) {
  if (lines.length === 0) {
    return { items: [], subtotal: 0, tax: 0, shipping: 0, total: 0 };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const items = lines
    .map((line) => {
      const p = byId.get(line.productId);
      if (!p) return null;
      const price = toNumber(p.price);
      return {
        id: line.id,
        productId: p.id,
        slug: p.slug,
        name: p.name,
        image: p.images[0] ?? null,
        price,
        quantity: line.quantity,
        material: p.material ?? undefined,
        variant: line.variant,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  const totals = computeTotals(items.map((i) => ({ price: i.price, quantity: i.quantity })));
  return { items, ...totals };
}

export async function getCart(req: Request) {
  return hydrateCart(await read(cartKey(req)));
}

export async function addItem(
  req: Request,
  productId: string,
  quantity: number,
  variant?: Record<string, string>
) {
  if (quantity < 1) throw ApiError.badRequest('Quantity must be at least 1');
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isPublished) throw ApiError.notFound('Product not found');
  if (product.stock < quantity) throw ApiError.badRequest('Insufficient stock');

  const key = cartKey(req);
  const lines = await read(key);
  const id = lineId(productId, variant);
  const existing = lines.find((l) => l.id === id);
  if (existing) existing.quantity += quantity;
  else lines.push({ id, productId, quantity, variant });

  await write(key, lines);
  return hydrateCart(lines);
}

export async function updateItem(req: Request, id: string, quantity: number) {
  const key = cartKey(req);
  let lines = await read(key);
  if (quantity <= 0) {
    lines = lines.filter((l) => l.id !== id);
  } else {
    const line = lines.find((l) => l.id === id);
    if (!line) throw ApiError.notFound('Item not in cart');
    line.quantity = quantity;
  }
  await write(key, lines);
  return hydrateCart(lines);
}

export async function removeItem(req: Request, id: string) {
  const key = cartKey(req);
  const lines = (await read(key)).filter((l) => l.id !== id);
  await write(key, lines);
  return hydrateCart(lines);
}

export async function clearCart(req: Request) {
  await redis.del(cartKey(req));
  return hydrateCart([]);
}

/** Return the raw stored lines (used by checkout to build the order). */
export async function getStoredLines(req: Request) {
  return read(cartKey(req));
}
