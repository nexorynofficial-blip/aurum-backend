import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import * as user from '../controllers/userController';

const router = Router();

router.use(requireAuth);

router.get('/profile', asyncHandler(user.getProfile));
router.patch('/profile', asyncHandler(user.updateProfile));

router.get('/addresses', asyncHandler(user.listAddresses));
router.post('/addresses', asyncHandler(user.createAddress));
router.patch('/addresses/:id', asyncHandler(user.updateAddress));
router.delete('/addresses/:id', asyncHandler(user.deleteAddress));

export default router;
