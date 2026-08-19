import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import collectionRoutes from './collection.routes';
import cartRoutes from './cart.routes';
import checkoutRoutes from './checkout.routes';
import orderRoutes from './order.routes';
import wishlistRoutes from './wishlist.routes';
import userRoutes from './user.routes';
import adminRoutes from './admin.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/collections', collectionRoutes);
router.use('/cart', cartRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/orders', orderRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);

export default router;
