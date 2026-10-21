import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createWithdrawal,
  cancelWithdrawal,
  getUserWithdrawals,
  getUserWithdrawalById,
} from '../services/withdrawalService.js';
import { AppError } from '../utils/AppError.js';

export const create = asyncHandler(async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return next(new AppError('Idempotency-Key header is required', 400, 'MISSING_IDEMPOTENCY_KEY'));
  }

  const { optionId, payoutDetails } = req.body;
  if (!optionId || !payoutDetails) {
    return next(new AppError('Please provide optionId and payoutDetails', 400, 'VALIDATION_ERROR'));
  }

  const result = await createWithdrawal({
    userId: req.user._id,
    optionId,
    payoutDetails,
    idempotencyKey,
    ip: req.ip,
  });

  if (result.duplicate) {
    return res.status(200).json({
      success: true,
      duplicate: true,
      message: result.message,
      data: result.withdrawal,
    });
  }

  res.status(201).json({
    success: true,
    duplicate: false,
    message: result.message,
    data: result.withdrawal,
  });
});

export const getMyWithdrawals = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const result = await getUserWithdrawals(req.user._id, { page, limit, status });

  res.status(200).json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});

export const getMyWithdrawalById = asyncHandler(async (req, res) => {
  const withdrawal = await getUserWithdrawalById(req.params.id, req.user._id);

  res.status(200).json({
    success: true,
    data: withdrawal,
  });
});

export const cancel = asyncHandler(async (req, res) => {
  const updated = await cancelWithdrawal({
    withdrawalId: req.params.id,
    userId: req.user._id,
    ip: req.ip,
  });

  res.status(200).json({
    success: true,
    message: 'Withdrawal cancelled successfully and balance refunded.',
    data: updated,
  });
});

export default {
  create,
  getMyWithdrawals,
  getMyWithdrawalById,
  cancel,
};
