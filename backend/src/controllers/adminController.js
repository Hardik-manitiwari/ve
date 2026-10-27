import { asyncHandler } from '../utils/asyncHandler.js';
import { adjustWallet } from '../services/walletService.js';
import { getAllWithdrawals, reviewWithdrawal } from '../services/withdrawalService.js';
import { reconcileUserWallet } from '../services/reconciliationService.js';
import { updatePayoutOption } from '../services/payoutService.js';
import { IdempotencyKey } from '../models/IdempotencyKey.js';
import { User } from '../models/User.js';
import { Wallet } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { Withdrawal } from '../models/Withdrawal.js';
import { AuditLog } from '../models/AuditLog.js';
import { PayoutOption } from '../models/PayoutOption.js';
import { AppError } from '../utils/AppError.js';
import { TRANSACTION_TYPES, WITHDRAWAL_STATUSES } from '../config/constants.js';

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
      // Ignore duplicate key collision if retry happened in parallel.
    }
  }

  return {
    isDuplicate: false,
    statusCode: 200,
    body: result,
  };
};

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

export const listAllWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit, status, userId } = req.query;
  const result = await getAllWithdrawals({ page, limit, status, userId });

  res.status(200).json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});

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

export const adminReconcileUser = asyncHandler(async (req, res) => {
  const result = await reconcileUserWallet(req.params.userId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

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

export const getAdminStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    pendingWithdrawals,
    pendingWithdrawalAgg,
    walletsAgg,
    totalTransactions,
  ] = await Promise.all([
    User.countDocuments(),
    Withdrawal.countDocuments({ status: WITHDRAWAL_STATUSES.PENDING }),
    Withdrawal.aggregate([
      { $match: { status: WITHDRAWAL_STATUSES.PENDING } },
      { $group: { _id: null, totalPendingVEs: { $sum: '$requiredAmount' } } },
    ]),
    Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalVEs: { $sum: '$VEs' },
          totalSVEs: { $sum: '$SVEs' },
          totalGems: { $sum: '$Gems' },
          totalTokens: { $sum: '$Tokens' },
          totalSpins: { $sum: '$Spins' },
        },
      },
    ]),
    WalletTransaction.countDocuments(),
  ]);

  const stats = {
    totalUsers,
    pendingWithdrawalsCount: pendingWithdrawals,
    pendingWithdrawalsAmount: pendingWithdrawalAgg[0]?.totalPendingVEs || 0,
    totalCirculatingVEs: walletsAgg[0]?.totalVEs || 0,
    totalCirculatingSVEs: walletsAgg[0]?.totalSVEs || 0,
    totalCirculatingGems: walletsAgg[0]?.totalGems || 0,
    totalTransactions,
  };

  res.status(200).json({
    success: true,
    data: stats,
  });
});

export const listAllUsers = asyncHandler(async (req, res) => {
  const { search, role, page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (role) query.role = role;
  if (search) {
    query.email = { $regex: search.trim(), $options: 'i' };
  }

  const [users, total] = await Promise.all([
    User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    User.countDocuments(query),
  ]);

  const userIds = users.map((u) => u._id);
  const wallets = await Wallet.find({ userId: { $in: userIds } }).lean();
  const walletMap = new Map(wallets.map((w) => [w.userId.toString(), w]));

  const data = users.map((u) => ({
    ...u,
    wallet: walletMap.get(u._id.toString()) || { VEs: 0, SVEs: 0, Gems: 0, Tokens: 0, Spins: 0 },
  }));

  res.status(200).json({
    success: true,
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
  });
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, action, targetUserId } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (action) query.action = action;
  if (targetUserId) query.targetUserId = targetUserId;

  const [logs, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    AuditLog.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
  });
});

export const listAllPayoutOptions = asyncHandler(async (req, res) => {
  const options = await PayoutOption.find().sort({ displayOrder: 1 }).lean();
  res.status(200).json({
    success: true,
    data: options,
  });
});

export default {
  adminCredit,
  adminDebit,
  listAllWithdrawals,
  reviewUserWithdrawal,
  adminReconcileUser,
  updateOptionConfig,
  getAdminStats,
  listAllUsers,
  listAuditLogs,
  listAllPayoutOptions,
};
