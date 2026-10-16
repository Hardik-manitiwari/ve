import { asyncHandler } from '../utils/asyncHandler.js';
import { adjustWallet } from '../services/walletService.js';
import { getAllWithdrawals, reviewWithdrawal } from '../services/withdrawalService.js';
import { reconcileUserWallet } from '../services/reconciliationService.js';
import { updatePayoutOption } from '../services/payoutService.js';
import { IdempotencyKey } from '../models/IdempotencyKey.js';
import { AppError } from '../utils/AppError.js';
import { TRANSACTION_TYPES } from '../config/constants.js';

/**
 * Handle idempotent admin action
 */
const handleIdempotentAdminAction = async (key, action, executeFn) => {
  if (key) {
    const existing = await IdempotencyKey.findOne({ key });
    if (existing) {
      return {
        isDuplicate: true,
        statusCode: existing.statusCode,
        body: existing.responseBody,
      };
    }
  }

  const result = await executeFn();

  if (key) {
    try {
      await IdempotencyKey.create({
        key,
        action,
        statusCode: 200,
        responseBody: result,
      });
    } catch (e) {
      // Ignore if key was created concurrently
    }
  }

  return {
    isDuplicate: false,
    statusCode: 200,
    body: result,
  };
};

/**
 * Admin credit wallet
 * POST /api/wallet/credit
 */
export const adminCredit = asyncHandler(async (req, res, next) => {
  const { userId, currency = 'VEs', amount, reason = 'Admin credit' } = req.body;
  const idempotencyKey = req.headers['idempotency-key'];

  if (!userId || !amount) {
    return next(new AppError('Please provide userId and amount', 400, 'VALIDATION_ERROR'));
  }

  const { statusCode, body } = await handleIdempotentAdminAction(
    idempotencyKey,
    'WALLET_CREDIT',
    async () => {
      const result = await adjustWallet({
        adminId: req.user._id,
        userId,
        type: TRANSACTION_TYPES.CREDIT,
        currency,
        amount,
        reason,
        ip: req.ip,
      });

      return {
        success: true,
        message: `Successfully credited ${amount} ${currency} to user`,
        data: {
          wallet: result.wallet,
          transaction: result.transaction,
        },
      };
    }
  );

  res.status(statusCode).json(body);
});

/**
 * Admin debit wallet
 * POST /api/wallet/debit
 */
export const adminDebit = asyncHandler(async (req, res, next) => {
  const { userId, currency = 'VEs', amount, reason = 'Admin debit' } = req.body;
  const idempotencyKey = req.headers['idempotency-key'];

  if (!userId || !amount) {
    return next(new AppError('Please provide userId and amount', 400, 'VALIDATION_ERROR'));
  }

  const { statusCode, body } = await handleIdempotentAdminAction(
    idempotencyKey,
    'WALLET_DEBIT',
    async () => {
      const result = await adjustWallet({
        adminId: req.user._id,
        userId,
        type: TRANSACTION_TYPES.DEBIT,
        currency,
        amount,
        reason,
        ip: req.ip,
      });

      return {
        success: true,
        message: `Successfully debited ${amount} ${currency} from user`,
        data: {
          wallet: result.wallet,
          transaction: result.transaction,
        },
      };
    }
  );

  res.status(statusCode).json(body);
});

/**
 * Admin list all withdrawals
 * GET /api/admin/withdrawals
 */
export const listAllWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit, status, userId } = req.query;
  const result = await getAllWithdrawals({ page, limit, status, userId });

  res.status(200).json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});

/**
 * Admin review withdrawal
 * POST /api/admin/withdrawals/:id/review
 */
export const reviewUserWithdrawal = asyncHandler(async (req, res, next) => {
  const { status, reviewNotes } = req.body;
  if (!status) {
    return next(new AppError('Please provide target status', 400, 'VALIDATION_ERROR'));
  }

  const updated = await reviewWithdrawal({
    withdrawalId: req.params.id,
    adminId: req.user._id,
    newStatus: status,
    reviewNotes,
    ip: req.ip,
  });

  res.status(200).json({
    success: true,
    message: `Withdrawal successfully updated to ${status}`,
    data: updated,
  });
});

/**
 * Admin reconcile user wallet
 * GET /api/admin/reconcile/:userId
 */
export const adminReconcileUser = asyncHandler(async (req, res) => {
  const result = await reconcileUserWallet(req.params.userId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Admin update payout option
 * PATCH /api/admin/payout-options/:optionId
 */
export const updateOptionConfig = asyncHandler(async (req, res) => {
  const updated = await updatePayoutOption(
    req.params.optionId,
    req.body,
    req.user._id,
    req.ip
  );

  res.status(200).json({
    success: true,
    message: 'Payout option updated successfully',
    data: updated,
  });
});

export default {
  adminCredit,
  adminDebit,
  listAllWithdrawals,
  reviewUserWithdrawal,
  adminReconcileUser,
  updateOptionConfig,
};
