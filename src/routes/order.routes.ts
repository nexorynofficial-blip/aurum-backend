import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { requireAuth } from '@/middleware/auth';
import * as orders from '@/controllers/orderController';

const router = Router();

router.use(requireAuth);
router.get('/', asyncHandler(orders.listOrders));
router.get('/:id', asyncHandler(orders.getOrder));

export default router;
