import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ApiError } from '../utils/apiError';
import { serializeProduct } from './productController';

export async function getWishlist(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const entries = await prisma.wishlist.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: { product: { include: { collections: { include: { collection: true } } } } },
  });
  res.json({
    items: entries.map((e) => ({ productId: e.productId, product: serializeProduct(e.product) })),
  });
}

const addSchema = z.object({ productId: z.string().min(1) });

export async function addToWishlist(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  const { productId } = addSchema.parse(req.body);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound('Product not found');

  await prisma.wishlist.upsert({
    where: { userId_productId: { userId: req.user.id, productId } },
    create: { userId: req.user.id, productId },
    update: {},
  });

  res.status(201).json({ message: 'Added to wishlist' });
}

export async function removeFromWishlist(req: Request, res: Response) {
  if (!req.user) throw ApiError.unauthorized();
  await prisma.wishlist.deleteMany({ where: { userId: req.user.id, productId: req.params.productId } });
  res.json({ message: 'Removed from wishlist' });
}
