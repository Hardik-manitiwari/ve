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

/**
 * Create a withdrawal request atomically inside a transaction (Option A).
 */
export const createWithdrawal = async ({
  userId,
  optionId,
  payoutDetails,
  idempotencyKey,
  ip = '',
}) => {
  // 1. Validate Idempotency Key format
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new AppError('Idempotency-Key header is required', 400, 'MISSING_IDEMPOTENCY_KEY');
  }

  const trimmedKey = idempotencyKey.trim();
  const idempotencyRegex = /^[A-Za-z0-9_-]{8,100}$/;
  if (!idempotencyRegex.test(trimmedKey)) {
    throw new AppError('Idempotency-Key must be 8-100 alphanumeric characters, underscores or dashes', 400, 'INVALID_IDEMPOTENCY_KEY');
  }

  // 2. Early Idempotency Check (read outside transaction for quick return)
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
      // 3. Double-check idempotency inside the transaction
      const inTxExisting = await Withdrawal.findOne({ userId, idempotencyKey: trimmedKey }).session(session);
      if (inTxExisting) {
        return {
          withdrawal: serializeWithdrawal(inTxExisting),
          duplicate: true,
          message: 'This withdrawal request has already been submitted.',
        };
      }

      // 4. Check max pending withdrawals
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

      // 5. Resolve payout option (client amount is strictly ignored)
      const option = await resolvePayoutOption(optionId, session);

      // 6. Validate and sanitize payout details
      const sanitizedDetails = validatePayoutDetails(option.method, payoutDetails);

      const withdrawalId = uuidv4();

      // 7. Deduct balance immediately with atomic balance guard
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

      // 8. Create Withdrawal record
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

      // 9. Write Audit Log
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
    // Fallback: If duplicate-key error 11000 occurred on concurrent insertion
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

/**
 * User cancels their own pending withdrawal.
 */
export const cancelWithdrawal = async ({ withdrawalId, userId, ip = '' }) => {
  return withTransaction(async (session) => {
    // Find withdrawal matching id and userId
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

    // Conditional atomic update
    const updated = await Withdrawal.findOneAndUpdate(
      { _id: withdrawal._id, status: WITHDRAWAL_STATUSES.PENDING },
      { $set: { status: WITHDRAWAL_STATUSES.CANCELLED, reviewNotes: 'Cancelled by user' } },
      { new: true, session }
    );

    if (!updated) {
      throw new AppError('Invalid status transition.', 409, 'INVALID_TRANSITION');
    }

    // Refund immediately via REVERSAL ledger entry
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

    // Audit log
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

/**
 * Admin review withdrawal: transition to PROCESSING, APPROVED, or REJECTED.
 */
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

  return withTransaction(async (session) => {
    const withdrawal = await Withdrawal.findOne({
      $or: [{ withdrawalId }, { _id: withdrawalId.match(/^[0-9a-fA-F]{24}$/) ? withdrawalId : null }],
    }).session(session);

    if (!withdrawal) {
      throw new AppError('Withdrawal not found', 404, 'NOT_FOUND');
    }

    // Validate state transition
    const allowedNextStatuses = ALLOWED_TRANSITIONS[withdrawal.status] || [];
    if (!allowedNextStatuses.includes(newStatus)) {
      throw new AppError('Invalid status transition.', 409, 'INVALID_TRANSITION');
    }

    // Conditional atomic update on current status to prevent race conditions
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

    // If REJECTED, refund via REVERSAL
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

    // Map audit action
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

/**
 * Get user's own withdrawals list.
 */
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

/**
 * Get single withdrawal by ID for a user.
 * Strictly checks user ownership - returns 404 if not found or belongs to another user.
 */
export const getUserWithdrawalById = async (withdrawalId, userId) => {
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

/**
 * Admin: List all withdrawals across all users with filters.
 */
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
