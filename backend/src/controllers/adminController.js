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
  const { userId, currency = 'VEs', amount, reason, correction = false } = req.body;
  const idempotencyKey = req.headers['idempotency-key'];

  if (!userId || amount === undefined || amount === null) {
    return next(new AppError('Please provide userId and amount', 400, 'VALIDATION_ERROR'));
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return next(new AppError('Please provide a reason', 400, 'VALIDATION_ERROR'));
  }

  const { statusCode, body } = await handleIdempotentAdminAction(
    idempotencyKey,
    correction ? 'BALANCE_CORRECTION' : 'WALLET_CREDIT',
    async () => {
      const result = await adjustWallet({
        adminId: req.user._id,
        userId,
        type: TRANSACTION_TYPES.CREDIT,
        currency,
        amount,
        reason: reason.trim(),
        correction: Boolean(correction),
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
  const { userId, currency = 'VEs', amount, reason, correction = false } = req.body;
  const idempotencyKey = req.headers['idempotency-key'];

  if (!userId || amount === undefined || amount === null) {
    return next(new AppError('Please provide userId and amount', 400, 'VALIDATION_ERROR'));
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    return next(new AppError('Please provide a reason', 400, 'VALIDATION_ERROR'));
  }

  const { statusCode, body } = await handleIdempotentAdminAction(
    idempotencyKey,
    correction ? 'BALANCE_CORRECTION' : 'WALLET_DEBIT',
    async () => {
      const result = await adjustWallet({
        adminId: req.user._id,
        userId,
        type: TRANSACTION_TYPES.DEBIT,
        currency,
        amount,
        reason: reason.trim(),
        correction: Boolean(correction),
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

  if (status === WITHDRAWAL_STATUSES.REJECTED) {
    if (!reviewNotes || typeof reviewNotes !== 'string' || !reviewNotes.trim() || reviewNotes.trim().length < 3) {
      return next(new AppError('A reason of at least 3 characters is required for rejection', 400, 'VALIDATION_ERROR'));
    }
  }

  const updated = await reviewWithdrawal({
    withdrawalId: req.params.id,
    adminId: req.user._id,
    newStatus: status,
    reviewNotes: reviewNotes ? reviewNotes.trim() : '',
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

export const getAdminSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const endOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  const [statusCountsAgg, todayAgg, walletsAgg] = await Promise.all([
    Withdrawal.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Withdrawal.aggregate([
      {
        $match: {
          status: { $in: [WITHDRAWAL_STATUSES.APPROVED, WITHDRAWAL_STATUSES.REJECTED] },
          $or: [
            { reviewedAt: { $gte: startOfTodayUTC, $lte: endOfTodayUTC } },
            { updatedAt: { $gte: startOfTodayUTC, $lte: endOfTodayUTC } },
          ],
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
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
  ]);

  const withdrawalCounts = {
    PENDING: 0,
    PROCESSING: 0,
    APPROVED: 0,
    REJECTED: 0,
    CANCELLED: 0,
  };
  statusCountsAgg.forEach((item) => {
    if (item._id && withdrawalCounts[item._id] !== undefined) {
      withdrawalCounts[item._id] = item.count;
    }
  });

  let approvedToday = 0;
  let rejectedToday = 0;
  todayAgg.forEach((item) => {
    if (item._id === WITHDRAWAL_STATUSES.APPROVED) approvedToday = item.count;
    if (item._id === WITHDRAWAL_STATUSES.REJECTED) rejectedToday = item.count;
  });

  const currencyTotals = {
    VEs: walletsAgg[0]?.totalVEs || 0,
    SVEs: walletsAgg[0]?.totalSVEs || 0,
    Gems: walletsAgg[0]?.totalGems || 0,
    Tokens: walletsAgg[0]?.totalTokens || 0,
    Spins: walletsAgg[0]?.totalSpins || 0,
  };

  res.status(200).json({
    success: true,
    data: {
      withdrawalCounts,
      today: {
        approved: approvedToday,
        rejected: rejectedToday,
      },
      approvedToday,
      rejectedToday,
      currencyTotals,
    },
  });
});

export const listAllUsers = asyncHandler(async (req, res) => {
  const { search, role, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (role) query.role = role;
  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { email: { $regex: s, $options: 'i' } },
      { name: { $regex: s, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query).select('-password -passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    User.countDocuments(query),
  ]);

  const userIds = users.map((u) => u._id);
  const wallets = await Wallet.find({ userId: { $in: userIds } }).lean();
  const walletMap = new Map(wallets.map((w) => [w.userId.toString(), w]));

  const data = users.map((u) => {
    const w = walletMap.get(u._id.toString()) || { VEs: 0, SVEs: 0, Gems: 0, Tokens: 0, Spins: 0 };
    return {
      id: u._id,
      email: u.email,
      name: u.name || '',
      role: u.role,
      accountStatus: u.accountStatus,
      VEs: w.VEs || 0,
      SVEs: w.SVEs || 0,
      Gems: w.Gems || 0,
      Tokens: w.Tokens || 0,
      Spins: w.Spins || 0,
      wallet: {
        VEs: w.VEs || 0,
        SVEs: w.SVEs || 0,
        Gems: w.Gems || 0,
        Tokens: w.Tokens || 0,
        Spins: w.Spins || 0,
      },
      createdAt: u.createdAt,
    };
  });

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

export const getUserById = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const user = await User.findById(userId).select('-password -passwordHash').lean();
  if (!user) {
    return next(new AppError('User not found', 404, 'NOT_FOUND'));
  }

  const [wallet, ledger] = await Promise.all([
    Wallet.findOne({ userId }).lean(),
    WalletTransaction.find({ userId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  const walletData = wallet
    ? { VEs: wallet.VEs || 0, SVEs: wallet.SVEs || 0, Gems: wallet.Gems || 0, Tokens: wallet.Tokens || 0, Spins: wallet.Spins || 0 }
    : { VEs: 0, SVEs: 0, Gems: 0, Tokens: 0, Spins: 0 };

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        name: user.name || '',
        role: user.role,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
      },
      wallet: walletData,
      ledger,
      transactions: ledger,
    },
  });
});

export const listLedgerRows = asyncHandler(async (req, res) => {
  const { userId, currency, type, category, from, to, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (userId) query.userId = userId;
  if (currency) query.currency = currency;
  if (type) query.type = type;
  if (category) query.category = category;

  if (from || to) {
    query.createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) query.createdAt.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) query.createdAt.$lte = toDate;
    }
  }

  const [items, total] = await Promise.all([
    WalletTransaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    WalletTransaction.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
  });
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, action, targetUserId } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
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
  const options = await PayoutOption.find().sort({ sortOrder: 1, requiredAmount: 1 }).lean();
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
  getAdminSummary,
  listAllUsers,
  getUserById,
  listLedgerRows,
  listAuditLogs,
  listAllPayoutOptions,
};
