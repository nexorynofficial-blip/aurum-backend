import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '@/utils/asyncHandler';
import { requireAdmin } from '@/middleware/auth';
import { healthDetailed } from '@/controllers/healthController';
import * as admin from '@/controllers/adminController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Public infra probe (matches setup guide: GET /api/admin/health)
router.get('/health', asyncHandler(healthDetailed));

// Everything below requires an admin session
router.use(requireAdmin);

router.get('/stats', asyncHandler(admin.stats));
router.get('/dashboard', asyncHandler(admin.dashboard));

router.get('/orders', asyncHandler(admin.listAllOrders));
router.get('/orders/:id', asyncHandler(admin.getOrderDetail));
router.patch('/orders/:id', asyncHandler(admin.updateOrder));

router.get('/products', asyncHandler(admin.listProducts));
router.get('/products/:id', asyncHandler(admin.getProduct));
router.post('/products', asyncHandler(admin.createProduct));
router.patch('/products/:id', asyncHandler(admin.updateProduct));
router.delete('/products/:id', asyncHandler(admin.deleteProduct));
router.post('/products/:id/image', upload.single('image'), asyncHandler(admin.uploadProductImage));

router.get('/collections', asyncHandler(admin.listCollections));
router.get('/customers', asyncHandler(admin.listCustomers));

export default router;
