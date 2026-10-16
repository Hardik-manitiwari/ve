import express from 'express';
import {
  listAllWithdrawals,
  reviewUserWithdrawal,
  adminReconcileUser,
  updateOptionConfig,
} from '../controllers/adminController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo(USER_ROLES.ADMIN));

router.get('/withdrawals', listAllWithdrawals);
router.post('/withdrawals/:id/review', reviewUserWithdrawal);
router.get('/reconcile/:userId', adminReconcileUser);
router.patch('/payout-options/:optionId', updateOptionConfig);

export default router;
