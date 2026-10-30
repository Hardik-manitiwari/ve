import { v4 as uuidv4 } from 'uuid';
import { Withdrawal } from '../models/Withdrawal.js';
import {
  WITHDRAWAL_STATUSES,
  ALLOWED_TRANSITIONS,
  MAX_PENDING_WITHDRAWALS,
  AUDIT_ACTIONS,
} from '../config/constants.js';
import { AppError } from '../utils/AppError.js';
import { withTransaction } from '../utils/transaction.js';
import { debitWallet, creditWallet } from './walletService.js';
import { resolvePayoutOption, validatePayoutDetails } from './payoutService.js';
import { recordAuditLog } from './auditService.js';
import { serializeWithdrawal } from '../utils/serializers.js';

export const createWithdrawal = async ({
  userId,
  optionId,
  payoutDetails,
  idempotencyKey,
  ip = '',
}) => {
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new AppError('Idempotency-Key header is required', 400, 'MISSING_IDEMPOTENCY_KEY');
  }

  const trimmedKey = idempotencyKey.trim();
  const idempotencyRegex = /^[A-Za-z0-9_-]{8,100}$/;
  if (!idempotencyRegex.test(trimmedKey)) {
    throw new AppError('Idempotency-Key must be 8-100 alphanumeric characters, underscores or dashes', 400, 'INVALID_IDEMPOTENCY_KEY');
  }

  // Check early to return quickly on duplicate clicks without opening a transaction.
  const existingWithdrawal = await Withdrawal.findOne({ userId, idempotencyKey: trimmedKey });
  if (existingWithdrawal) {
    return {
      withdrawal: serializeWithdrawal(existingWithdrawal),
      duplicate: true,
      message: 'This withdrawal request has already been submitted.',
    };
  }

  try {
    return await withTransaction(async (session) => {
      // Re-check inside the transaction to avoid race condition on concurrent submits.
      const inTxExisting = await Withdrawal.findOne({ userId, idempotencyKey: trimmedKey }).session(session);
      if (inTxExisting) {
        return {
          withdrawal: serializeWithdrawal(inTxExisting),
          duplicate: true,
          message: 'This withdrawal request has already been submitted.',
        };
      }

      const pendingCount = await Withdrawal.countDocuments({
        userId,
        status: WITHDRAWAL_STATUSES.PENDING,
      }).session(session);

      if (pendingCount >= MAX_PENDING_WITHDRAWALS) {
        throw new AppError(
          'Maximum pending withdrawal requests reached.',
          409,
          'TOO_MANY_PENDING'
        );
      }

      // Amounts are decided by the optionId lookup on the server, ignoring whatever the client sends.
      const option = await resolvePayoutOption(optionId, session);
      const sanitizedDetails = validatePayoutDetails(option.method, payoutDetails);
      const withdrawalId = uuidv4();

      // Deduct points immediately so the user cannot double-spend while review is pending.
      await debitWallet({
        userId,
        currency: option.currency,
        amount: option.requiredAmount,
        category: 'WITHDRAWAL',
        referenceId: withdrawalId,
        source: 'USER',
        description: `Withdrawal for ${option.name}`,
        metadata: {
          optionId: option.optionId,
          method: option.method,
          withdrawalId,
        },
        session,
      });

      const [withdrawal] = await Withdrawal.create(
        [
          {
            withdrawalId,
            userId,
            idempotencyKey: trimmedKey,
            optionId: option.optionId,
            method: option.method,
            currency: option.currency,
            requiredAmount: option.requiredAmount,
            payoutValue: option.payoutValue,
            payoutCurrency: option.payoutCurrency,
            payoutDetails: sanitizedDetails,
            status: WITHDRAWAL_STATUSES.PENDING,
          },
        ],
        { session }
      );

      await recordAuditLog({
        actorId: userId,
        action: AUDIT_ACTIONS.WITHDRAWAL_CREATED,
        targetUserId: userId,
        targetType: 'WITHDRAWAL',
        referenceId: withdrawalId,
        metadata: {
          optionId: option.optionId,
          requiredAmount: option.requiredAmount,
          payoutValue: option.payoutValue,
          idempotencyKey: trimmedKey,
        },
        ip,
        session,
      });

      return {
        withdrawal: serializeWithdrawal(withdrawal),
        duplicate: false,
        message: 'Withdrawal submitted successfully. Status: Pending',
      };
    });
  } catch (error) {
    // If two requests hit MongoDB at the exact same time, the compound unique index catches it.
    if (error.code === 11000 && error.keyPattern?.idempotencyKey) {
      const fallbackDoc = await Withdrawal.findOne({ userId, idempotencyKey: trimmedKey });
      if (fallbackDoc) {
        return {
          withdrawal: serializeWithdrawal(fallbackDoc),
          duplicate: true,
          message: 'This withdrawal request has already been submitted.',
        };
      }
    }
    throw error;
  }
};

export const cancelWithdrawal = async ({ withdrawalId, userId, ip = '' }) => {
  return withTransaction(async (session) => {
    const withdrawal = await Withdrawal.findOne({
      $or: [{ withdrawalId }, { _id: withdrawalId.match(/^[0-9a-fA-F]{24}$/) ? withdrawalId : null }],
      userId,
    }).session(session);

    if (!withdrawal) {
      throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
    }

    if (withdrawal.status !== WITHDRAWAL_STATUSES.PENDING) {
      throw new AppError('Invalid status transition.', 409, 'INVALID_TRANSITION');
    }

    // Matching current status in the filter prevents double cancellation.
    const updated = await Withdrawal.findOneAndUpdate(
      { _id: withdrawal._id, status: WITHDRAWAL_STATUSES.PENDING },
      { $set: { status: WITHDRAWAL_STATUSES.CANCELLED, reviewNotes: 'Cancelled by user' } },
      { new: true, session }
    );

    if (!updated) {
      throw new AppError('Invalid status transition.', 409, 'INVALID_TRANSITION');
    }

    // Refund points through a REVERSAL row so past ledger history remains untouched.
    await creditWallet({
      userId,
      currency: withdrawal.currency,
      amount: withdrawal.requiredAmount,
      category: 'REVERSAL',
      referenceId: withdrawal.withdrawalId,
      source: 'USER',
      description: `Refund for cancelled withdrawal #${withdrawal.withdrawalId.substring(0, 8)}`,
      metadata: {
        withdrawalId: withdrawal.withdrawalId,
        action: 'USER_CANCEL',
      },
      session,
    });

    await recordAuditLog({
      actorId: userId,
      action: AUDIT_ACTIONS.WITHDRAWAL_CANCELLED,
      targetUserId: userId,
      targetType: 'WITHDRAWAL',
      referenceId: withdrawal.withdrawalId,
      metadata: {
        refundedAmount: withdrawal.requiredAmount,
        currency: withdrawal.currency,
      },
      ip,
      session,
    });

    return serializeWithdrawal(updated);
  });
};

export const reviewWithdrawal = async ({
  withdrawalId,
  adminId,
  newStatus,
  reviewNotes = '',
  ip = '',
}) => {
  if (!Object.values(WITHDRAWAL_STATUSES).includes(newStatus)) {
    throw new AppError('Invalid withdrawal status', 400, 'INVALID_STATUS');
  }

  if (newStatus === WITHDRAWAL_STATUSES.REJECTED) {
    if (!reviewNotes || typeof reviewNotes !== 'string' || !reviewNotes.trim() || reviewNotes.trim().length < 3) {
      throw new AppError('A reason of at least 3 characters is required for rejection', 400, 'VALIDATION_ERROR');
    }
  }

  return withTransaction(async (session) => {
    const withdrawal = await Withdrawal.findOne({
      $or: [{ withdrawalId }, { _id: withdrawalId.match(/^[0-9a-fA-F]{24}$/) ? withdrawalId : null }],
    }).session(session);

    if (!withdrawal) {
      throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
    }

    const allowedNextStatuses = ALLOWED_TRANSITIONS[withdrawal.status] || [];
    if (!allowedNextStatuses.includes(newStatus)) {
      throw new AppError('Invalid status transition.', 409, 'INVALID_TRANSITION');
    }

    // Match on current status so two admins reviewing at the same time cannot both write.
    const updated = await Withdrawal.findOneAndUpdate(
      { _id: withdrawal._id, status: withdrawal.status },
      {
        $set: {
          status: newStatus,
          reviewNotes,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      },
      { new: true, session }
    );

    if (!updated) {
      throw new AppError('Invalid status transition.', 409, 'INVALID_TRANSITION');
    }

    // Rejecting restores user points via REVERSAL ledger record.
    if (newStatus === WITHDRAWAL_STATUSES.REJECTED) {
      await creditWallet({
        userId: withdrawal.userId,
        currency: withdrawal.currency,
        amount: withdrawal.requiredAmount,
        category: 'REVERSAL',
        referenceId: withdrawal.withdrawalId,
        source: 'ADMIN',
        description: `Refund for rejected withdrawal #${withdrawal.withdrawalId.substring(0, 8)}: ${reviewNotes || 'Admin rejection'}`,
        metadata: {
          withdrawalId: withdrawal.withdrawalId,
          adminId,
          reviewNotes,
        },
        session,
      });
    }

    let auditAction = AUDIT_ACTIONS.WITHDRAWAL_PROCESSING;
    if (newStatus === WITHDRAWAL_STATUSES.APPROVED) auditAction = AUDIT_ACTIONS.WITHDRAWAL_APPROVED;
    if (newStatus === WITHDRAWAL_STATUSES.REJECTED) auditAction = AUDIT_ACTIONS.WITHDRAWAL_REJECTED;

    await recordAuditLog({
      actorId: adminId,
      action: auditAction,
      targetUserId: withdrawal.userId,
      targetType: 'WITHDRAWAL',
      referenceId: withdrawal.withdrawalId,
      metadata: {
        fromStatus: withdrawal.status,
        toStatus: newStatus,
        reviewNotes,
      },
      ip,
      session,
    });

    return serializeWithdrawal(updated);
  });
};

export const getUserWithdrawals = async (userId, { page = 1, limit = 20, status } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = { userId };
  if (status && Object.values(WITHDRAWAL_STATUSES).includes(status)) {
    query.status = status;
  }

  const [items, total] = await Promise.all([
    Withdrawal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Withdrawal.countDocuments(query),
  ]);

  return {
    items: items.map(serializeWithdrawal),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
};

export const getUserWithdrawalById = async (withdrawalId, userId) => {
  // Query includes userId so callers cannot inspect another user's withdrawal.
  const query = {
    $or: [
      { withdrawalId },
      { _id: withdrawalId.match(/^[0-9a-fA-F]{24}$/) ? withdrawalId : null },
    ],
    userId,
  };

  const withdrawal = await Withdrawal.findOne(query).lean();
  if (!withdrawal) {
    throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
  }

  return serializeWithdrawal(withdrawal);
};

export const getAllWithdrawals = async ({ page = 1, limit = 20, status, userId } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = {};
  if (status && Object.values(WITHDRAWAL_STATUSES).includes(status)) {
    query.status = status;
  }
  if (userId) {
    query.userId = userId;
  }

  const [items, total] = await Promise.all([
    Withdrawal.find(query)
      .populate('userId', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Withdrawal.countDocuments(query),
  ]);

  return {
    items: items.map((item) => ({
      ...serializeWithdrawal(item),
      userEmail: item.userId?.email || null,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
};

export default {
  createWithdrawal,
  cancelWithdrawal,
  reviewWithdrawal,
  getUserWithdrawals,
  getUserWithdrawalById,
  getAllWithdrawals,
};
