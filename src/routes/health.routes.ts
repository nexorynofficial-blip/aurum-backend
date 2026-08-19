import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { health, healthDetailed } from '@/controllers/healthController';

const router = Router();

router.get('/', health);
router.get('/ready', asyncHandler(healthDetailed));

export default router;
