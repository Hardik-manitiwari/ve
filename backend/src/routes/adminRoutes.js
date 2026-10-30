import express from 'express';
import {
  listAllWithdrawals,
  reviewUserWithdrawal,
  adminReconcileUser,
  updateOptionConfig,
  adminCredit,
  adminDebit,
  getAdminStats,
  getAdminSummary,
  listAllUsers,
  getUserById,
  listLedgerRows,
  listAuditLogs,
  listAllPayoutOptions,
} from '../controllers/adminController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { USER_ROLES } from '../config/constants.js';

const router = express.Router();

router.use(authenticate);
router.use(requireRole(USER_ROLES.ADMIN));

// Summary & Stats
router.get('/summary', getAdminSummary);
router.get('/stats', getAdminStats);

// User & Balance Directory
router.get('/users', listAllUsers);
router.get('/users/:userId', getUserById);
router.post('/credit', adminCredit);
router.post('/debit', adminDebit);

// Reconciliation
router.get('/reconcile/:userId', adminReconcileUser);

// Withdrawals Review Queue
router.get('/withdrawals', listAllWithdrawals);
router.post('/withdrawals/:id/review', reviewUserWithdrawal);

// Payout Options Configuration
router.get('/payout-options', listAllPayoutOptions);
router.patch('/payout-options/:optionId', updateOptionConfig);

// Ledger Records
router.get('/ledger', listLedgerRows);

// System Audit Logs
router.get('/audit', listAuditLogs);
router.get('/audit-logs', listAuditLogs);

export default router;
