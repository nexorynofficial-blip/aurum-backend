import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { toNumber } from '../utils/validators';
import { ApiError } from '../utils/apiError';

type ProductRow = Prisma.ProductGetPayload<{
  include: { collections: { include: { collection: true } } };
}>;

export function serializeProduct(p: ProductRow) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    slug: p.slug,
    description: p.description,
    story: p.story ?? undefined,
    price: toNumber(p.price),
    images: p.images,
    material: p.material ?? undefined,
    color: p.color ?? undefined,
    stoneType: p.stoneType ?? undefined,
    weightGrams: toNumber(p.weight) || undefined,
    stock: p.stock,
    availability:
      p.stock <= 0 ? 'out-of-stock' : p.stock <= 2 ? 'limited' : 'in-stock',
    isNew: p.isNew,
    variants: p.variants ?? undefined,
    details: p.details ?? undefined,
    collections: p.collections.map((c) => c.collection.slug),
  };
}

const SORT_MAP: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  'price-asc': { price: 'asc' },
  'price-desc': { price: 'desc' },
  curated: { createdAt: 'desc' },
};

export async function listProducts(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(60, Math.max(1, Number(req.query.limit ?? 20)));
  const { sort, material, stone, search, category } = req.query as Record<string, string>;
  const priceMin = req.query.priceMin ? Number(req.query.priceMin) : undefined;
  const priceMax = req.query.priceMax ? Number(req.query.priceMax) : undefined;

  const where: Prisma.ProductWhereInput = { isPublished: true };
  if (material) where.material = material;
  if (stone) where.stoneType = stone;
  if (priceMin != null || priceMax != null) {
    where.price = {};
    if (priceMin != null) (where.price as Prisma.DecimalFilter).gte = priceMin;
    if (priceMax != null) (where.price as Prisma.DecimalFilter).lte = priceMax;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category && category !== 'all') {
    where.collections = { some: { collection: { slug: category } } };
  }

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { collections: { include: { collection: true } } },
      orderBy: SORT_MAP[sort] ?? SORT_MAP.newest,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  res.json({
    data: rows.map(serializeProduct),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getProduct(req: Request, res: Response) {
  const { id } = req.params;
  const product = await prisma.product.findFirst({
    where: { OR: [{ id }, { slug: id }], isPublished: true },
    include: { collections: { include: { collection: true } } },
  });
  if (!product) throw ApiError.notFound('Product not found');
  res.json(serializeProduct(product));
}

export async function getRelatedProducts(req: Request, res: Response) {
  const { id } = req.params;
  const base = await prisma.product.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: { collections: true },
  });
  if (!base) throw ApiError.notFound('Product not found');

  const collectionIds = base.collections.map((c) => c.collectionId);
  const related = await prisma.product.findMany({
    where: {
      isPublished: true,
      id: { not: base.id },
      collections: { some: { collectionId: { in: collectionIds } } },
    },
    include: { collections: { include: { collection: true } } },
    take: 4,
  });
  res.json({ data: related.map(serializeProduct) });
}
