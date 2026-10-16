import express from 'express';
import {
  getUserWallet,
  getUserWalletSummary,
  getUserTransactions,
  reconcileWallet,
} from '../controllers/walletController.js';
import { adminCredit, adminDebit } from '../controllers/adminController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { walletMutationLimiter } from '../middleware/rateLimit.js';
import { USER_ROLES } from '../config/constants.js';

const router = express.Router();

router.use(protect);

router.get('/', getUserWallet);
router.get('/summary', getUserWalletSummary);
router.get('/transactions', getUserTransactions);
router.get('/reconcile', reconcileWallet);

// Admin wallet adjustment routes under /wallet
router.post(
  '/credit',
  restrictTo(USER_ROLES.ADMIN),
  walletMutationLimiter,
  adminCredit
);

router.post(
  '/debit',
  restrictTo(USER_ROLES.ADMIN),
  walletMutationLimiter,
  adminDebit
);

export default router;
