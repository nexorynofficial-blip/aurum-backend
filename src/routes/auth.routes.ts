import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { authRateLimiter } from '@/middleware/rateLimit';
import { optionalAuth, requireAuth } from '@/middleware/auth';
import * as auth from '@/controllers/authController';

const router = Router();

router.post('/register', authRateLimiter, asyncHandler(auth.register));
router.post('/login', authRateLimiter, asyncHandler(auth.login));
router.post('/logout', optionalAuth, asyncHandler(auth.logout));
router.get('/me', requireAuth, asyncHandler(auth.me));
router.post('/forgot-password', authRateLimiter, asyncHandler(auth.requestPasswordReset));
router.post('/reset-password', authRateLimiter, asyncHandler(auth.resetPassword));

export default router;
