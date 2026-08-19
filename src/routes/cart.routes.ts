import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { optionalAuth } from '@/middleware/auth';
import { cartContext } from '@/middleware/cartContext';
import * as cart from '@/controllers/cartController';

const router = Router();

// Carts work for both guests (cookie) and authenticated users.
router.use(optionalAuth, cartContext);

router.get('/', asyncHandler(cart.getCart));
router.post('/items', asyncHandler(cart.addToCart));
router.patch('/items/:id', asyncHandler(cart.updateCartItem));
router.delete('/items/:id', asyncHandler(cart.removeCartItem));
router.delete('/', asyncHandler(cart.clearCart));

export default router;
