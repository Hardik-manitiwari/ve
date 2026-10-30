import { v4 as uuidv4 } from 'uuid';
import { Wallet } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import { Withdrawal } from '../models/Withdrawal.js';
import { CURRENCIES, TRANSACTION_TYPES, TRANSACTION_CATEGORIES, AUDIT_ACTIONS } from '../config/constants.js';
import { AppError } from '../utils/AppError.js';
import { withTransaction } from '../utils/transaction.js';
import { recordAuditLog } from './auditService.js';

export const ensureWallet = async (userId, session = null) => {
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  if (session) options.session = session;

  return Wallet.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        VEs: 0,
        SVEs: 0,
        Gems: 0,
        Tokens: 0,
        Spins: 0,
      },
    },
    options
  );
};

export const applyMovement = async ({
  userId,
  currency = 'VEs',
  type,
  amount,
  category,
  referenceId = uuidv4(),
  source = 'SYSTEM',
  description = '',
  metadata = {},
  session = null,
}) => {
  if (!CURRENCIES.includes(currency)) {
    throw new AppError(`Unsupported currency: ${currency}`, 400, 'INVALID_CURRENCY');
  }

  const numericAmount = Number(amount);
  if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
    throw new AppError('Amount must be a positive integer', 400, 'INVALID_AMOUNT');
  }

  const executeInSession = async (activeSession) => {
    let balanceBefore;
    let balanceAfter;
    let updatedWallet;

    if (type === TRANSACTION_TYPES.DEBIT) {
      // The $gte check guards against negative balance under concurrent debits.
      updatedWallet = await Wallet.findOneAndUpdate(
        {
          userId,
          [currency]: { $gte: numericAmount },
        },
        {
          $inc: { [currency]: -numericAmount },
        },
        {
          new: true,
          session: activeSession,
        }
      );

      if (!updatedWallet) {
        const message = currency === 'VEs'
          ? 'Insufficient VEs balance.'
          : `Insufficient ${currency} balance.`;
        throw new AppError(message, 422, 'INSUFFICIENT_BALANCE');
      }

      balanceAfter = updatedWallet[currency];
      balanceBefore = balanceAfter + numericAmount;
    } else if (type === TRANSACTION_TYPES.CREDIT) {
      // Set defaults for other currencies on first insert so wallet stays consistent.
      const setOnInsert = {};
      CURRENCIES.forEach((c) => {
        if (c !== currency) {
          setOnInsert[c] = 0;
        }
      });

      updatedWallet = await Wallet.findOneAndUpdate(
        { userId },
        {
          $inc: { [currency]: numericAmount },
          $setOnInsert: setOnInsert,
        },
        {
          upsert: true,
          new: true,
          session: activeSession,
        }
      );

      balanceAfter = updatedWallet[currency];
      balanceBefore = balanceAfter - numericAmount;
    } else {
      throw new AppError(`Invalid transaction type: ${type}`, 400, 'INVALID_TYPE');
    }

    // Ledger row is written in the same transaction to keep history append-only.
    const transactionId = uuidv4();
    const ledgerRows = await WalletTransaction.create(
      [
        {
          transactionId,
          userId,
          currency,
          type,
          category,
          amount: numericAmount,
          balanceBefore,
          balanceAfter,
          source,
          referenceId,
          status: 'COMPLETED',
          description,
          metadata,
          createdAt: new Date(),
        },
      ],
      { session: activeSession }
    );

    return {
      wallet: updatedWallet,
      transaction: ledgerRows[0],
    };
  };

  if (session) {
    return executeInSession(session);
  }

  return withTransaction(executeInSession);
};

export const creditWallet = async ({
  userId,
  currency = 'VEs',
  amount,
  category = 'REWARD',
  referenceId,
  source = 'SYSTEM',
  description = '',
  metadata = {},
  session = null,
}) => {
  if (!TRANSACTION_CATEGORIES.CREDIT.includes(category)) {
    throw new AppError(`Invalid credit category: ${category}`, 400, 'INVALID_CATEGORY');
  }

  return applyMovement({
    userId,
    currency,
    type: TRANSACTION_TYPES.CREDIT,
    amount,
    category,
    referenceId,
    source,
    description,
    metadata,
    session,
  });
};

export const debitWallet = async ({
  userId,
  currency = 'VEs',
  amount,
  category = 'WITHDRAWAL',
  referenceId,
  source = 'SYSTEM',
  description = '',
  metadata = {},
  session = null,
}) => {
  if (!TRANSACTION_CATEGORIES.DEBIT.includes(category)) {
    throw new AppError(`Invalid debit category: ${category}`, 400, 'INVALID_CATEGORY');
  }

  return applyMovement({
    userId,
    currency,
    type: TRANSACTION_TYPES.DEBIT,
    amount,
    category,
    referenceId,
    source,
    description,
    metadata,
    session,
  });
};

export const adjustWallet = async ({
  adminId,
  userId,
  type,
  currency = 'VEs',
  amount,
  reason = 'Admin adjustment',
  correction = false,
  metadata = {},
  ip = '',
  session = null,
}) => {
  const isCredit = type === TRANSACTION_TYPES.CREDIT;
  const category = correction ? 'CORRECTION' : (isCredit ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT');
  const auditAction = correction ? AUDIT_ACTIONS.BALANCE_CORRECTION : (isCredit ? AUDIT_ACTIONS.WALLET_CREDIT : AUDIT_ACTIONS.WALLET_DEBIT);

  const execute = async (activeSession) => {
    const movement = await applyMovement({
      userId,
      currency,
      type,
      amount,
      category,
      referenceId: uuidv4(),
      source: 'ADMIN',
      description: reason,
      metadata: { ...metadata, adminId, reason, correction: Boolean(correction) },
      session: activeSession,
    });

    await recordAuditLog({
      actorId: adminId,
      action: auditAction,
      targetUserId: userId,
      targetType: 'WALLET',
      referenceId: movement.transaction.transactionId,
      metadata: {
        currency,
        amount,
        type,
        reason,
        correction: Boolean(correction),
        balanceBefore: movement.transaction.balanceBefore,
        balanceAfter: movement.transaction.balanceAfter,
      },
      ip,
      session: activeSession,
    });

    return movement;
  };

  if (session) {
    return execute(session);
  }

  return withTransaction(execute);
};

export const getWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await ensureWallet(userId);
  }
  return {
    userId: wallet.userId,
    VEs: wallet.VEs,
    SVEs: wallet.SVEs,
    Gems: wallet.Gems,
    Tokens: wallet.Tokens,
    Spins: wallet.Spins,
    updatedAt: wallet.updatedAt,
  };
};

export const getTransactions = async (userId, { page = 1, limit = 20, currency } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = { userId };
  if (currency && CURRENCIES.includes(currency)) {
    query.currency = currency;
  }

  const [items, total] = await Promise.all([
    WalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    WalletTransaction.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
};

export const getSummary = async (userId) => {
  const [wallet, pendingCount, totals] = await Promise.all([
    getWallet(userId),
    Withdrawal.countDocuments({ userId, status: 'PENDING' }),
    WalletTransaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: { currency: '$currency', type: '$type' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const activity = {
    totalCredited: 0,
    totalDebited: 0,
  };

  totals.forEach((row) => {
    if (row._id.currency === 'VEs') {
      if (row._id.type === 'CREDIT') activity.totalCredited = row.totalAmount;
      if (row._id.type === 'DEBIT') activity.totalDebited = row.totalAmount;
    }
  });

  return {
    balances: wallet,
    summary: {
      pendingWithdrawals: pendingCount,
      vesActivity: activity,
    },
  };
};

export default {
  ensureWallet,
  applyMovement,
  creditWallet,
  debitWallet,
  adjustWallet,
  getWallet,
  getTransactions,
  getSummary,
};
