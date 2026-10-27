import express from 'express';
import {
  listAllWithdrawals,
  reviewUserWithdrawal,
  adminReconcileUser,
  updateOptionConfig,
  adminCredit,
  adminDebit,
  getAdminStats,
  listAllUsers,
  listAuditLogs,
  listAllPayoutOptions,
} from '../controllers/adminController.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';

const router = express.Router();

router.use(protect);
router.use(restrictTo(USER_ROLES.ADMIN));

// Metrics & Analytics
router.get('/stats', getAdminStats);

// User & Balance Directory
router.get('/users', listAllUsers);
router.post('/credit', adminCredit);
router.post('/debit', adminDebit);
router.get('/reconcile/:userId', adminReconcileUser);

// Withdrawals Review Queue
router.get('/withdrawals', listAllWithdrawals);
router.post('/withdrawals/:id/review', reviewUserWithdrawal);

// Payout Options Configuration
router.get('/payout-options', listAllPayoutOptions);
router.patch('/payout-options/:optionId', updateOptionConfig);

// System Audit Logs
router.get('/audit-logs', listAuditLogs);

export default router;
