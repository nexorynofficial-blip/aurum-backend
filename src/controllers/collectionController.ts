import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';
import { serializeProduct } from './productController';

export async function listCollections(_req: Request, res: Response) {
  const collections = await prisma.collection.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });

  res.json({
    data: collections.map((c) => ({
      slug: c.slug,
      name: c.name,
      tagline: c.tagline ?? '',
      description: c.description,
      image: c.image ?? null,
      count: c._count.products,
    })),
  });
}

export async function getCollection(req: Request, res: Response) {
  const { slug } = req.params;
  const collection = await prisma.collection.findUnique({
    where: { slug },
    include: {
      products: {
        where: { product: { isPublished: true } },
        orderBy: { sortOrder: 'asc' },
        include: {
          product: { include: { collections: { include: { collection: true } } } },
        },
      },
    },
  });
  if (!collection || !collection.isPublished) throw ApiError.notFound('Collection not found');

  res.json({
    slug: collection.slug,
    name: collection.name,
    tagline: collection.tagline ?? '',
    description: collection.description,
    image: collection.image ?? null,
    products: collection.products.map((cp) => serializeProduct(cp.product)),
  });
}
