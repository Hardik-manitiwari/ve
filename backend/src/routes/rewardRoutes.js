import express from 'express';
import { claimDaily, claimAd, getStatus } from '../controllers/rewardController.js';
import { protect } from '../middleware/auth.js';
import { walletMutationLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.use(protect);

router.post('/daily', walletMutationLimiter, claimDaily);
router.post('/ad', walletMutationLimiter, claimAd);
router.get('/status', getStatus);

export default router;
