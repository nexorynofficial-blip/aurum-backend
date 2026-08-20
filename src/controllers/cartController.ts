import { Request, Response } from 'express';
import { z } from 'zod';
import * as cart from '../services/cartService';

export async function getCart(req: Request, res: Response) {
  res.json(await cart.getCart(req));
}

const addSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  variant: z.record(z.string()).optional(),
});

export async function addToCart(req: Request, res: Response) {
  const { productId, quantity, variant } = addSchema.parse(req.body);
  const updated = await cart.addItem(req, productId, quantity, variant);
  res.status(201).json({ message: 'Item added to cart', cart: updated });
}

const updateSchema = z.object({ quantity: z.number().int() });

export async function updateCartItem(req: Request, res: Response) {
  const { quantity } = updateSchema.parse(req.body);
  const updated = await cart.updateItem(req, req.params.id, quantity);
  res.json({ message: 'Cart updated', cart: updated });
}

export async function removeCartItem(req: Request, res: Response) {
  const updated = await cart.removeItem(req, req.params.id);
  res.json({ message: 'Item removed', cart: updated });
}

export async function clearCart(req: Request, res: Response) {
  const updated = await cart.clearCart(req);
  res.json({ message: 'Cart cleared', cart: updated });
}
