import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { optionalAuth } from '../middleware/auth';
import { cartContext } from '../middleware/cartContext';
import * as checkout from '../controllers/checkoutController';

const router = Router();

router.use(optionalAuth, cartContext);

router.post('/shipping', asyncHandler(checkout.getShippingOptions));
router.post('/create-payment-intent', asyncHandler(checkout.createIntent));
router.post('/confirm-order', asyncHandler(checkout.confirmOrder));
// Simulated checkout (no Stripe keys required) — creates a paid order directly.
router.post('/place-order', asyncHandler(checkout.placeOrder));

export default router;
