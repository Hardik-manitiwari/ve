import express from 'express';
import {
  create,
  getMyWithdrawals,
  getMyWithdrawalById,
  cancel,
} from '../controllers/withdrawalController.js';
import { protect } from '../middleware/auth.js';
import { withdrawalCreationLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.use(protect);

router.post('/', withdrawalCreationLimiter, create);
router.get('/', getMyWithdrawals);
router.get('/:id', getMyWithdrawalById);
router.post('/:id/cancel', cancel);

export default router;
