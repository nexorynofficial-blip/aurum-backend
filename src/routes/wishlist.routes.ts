import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { requireAuth } from '@/middleware/auth';
import * as wishlist from '@/controllers/wishlistController';

const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(wishlist.getWishlist));
router.post('/items', asyncHandler(wishlist.addToWishlist));
router.delete('/items/:productId', asyncHandler(wishlist.removeFromWishlist));

export default router;
