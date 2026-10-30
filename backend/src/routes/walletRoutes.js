import express from 'express';
import {
  getUserWallet,
  getUserWalletSummary,
  getUserTransactions,
  reconcileWallet,
} from '../controllers/walletController.js';
import { adminCredit, adminDebit } from '../controllers/adminController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { walletMutationLimiter } from '../middleware/rateLimit.js';
import { USER_ROLES } from '../config/constants.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getUserWallet);
router.get('/summary', getUserWalletSummary);
router.get('/transactions', getUserTransactions);
router.get('/reconcile', reconcileWallet);

// Admin wallet adjustment routes under /wallet
router.post(
  '/credit',
  requireRole(USER_ROLES.ADMIN),
  walletMutationLimiter,
  adminCredit
);

router.post(
  '/debit',
  requireRole(USER_ROLES.ADMIN),
  walletMutationLimiter,
  adminDebit
);

export default router;
