import { Router } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import * as collections from '@/controllers/collectionController';

const router = Router();

router.get('/', asyncHandler(collections.listCollections));
router.get('/:slug', asyncHandler(collections.getCollection));

export default router;
