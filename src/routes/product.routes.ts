import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import * as products from '@/controllers/productController';

const router = Router();

router.get('/', asyncHandler(products.listProducts));
router.get('/:id', asyncHandler(products.getProduct));
router.get('/:id/related', asyncHandler(products.getRelatedProducts));

export default router;
