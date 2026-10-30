import { PayoutOption } from '../models/PayoutOption.js';
import { PAYOUT_METHODS } from '../config/payoutMethods.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { AppError } from '../utils/AppError.js';
import { recordAuditLog } from './auditService.js';
import { withTransaction } from '../utils/transaction.js';

export const getPayoutMethods = async () => {
  // Count active options in the DB so methods with 0 options show as unavailable.
  const activeCounts = await PayoutOption.aggregate([
    { $match: { active: true } },
    { $group: { _id: '$method', count: { $sum: 1 } } },
  ]);

  const activeCountMap = {};
  activeCounts.forEach((item) => {
    activeCountMap[item._id] = item.count;
  });

  return Object.values(PAYOUT_METHODS).map((method) => {
    const hasActiveOptions = (activeCountMap[method.id] || 0) > 0;
    return {
      id: method.id,
      name: method.name,
      description: method.description,
      payoutCurrency: method.payoutCurrency,
      requiredFields: method.requiredFields,
      available: hasActiveOptions,
    };
  });
};

export const getOptionsByMethod = async (methodId) => {
  const methodConfig = PAYOUT_METHODS[methodId];
  if (!methodConfig) {
    throw new AppError('This payout method is currently unavailable.', 503, 'INACTIVE_PAYOUT_METHOD');
  }

  const options = await PayoutOption.find({
    method: methodId,
    active: true,
  })
    .sort({ sortOrder: 1, requiredAmount: 1 })
    .lean();

  return {
    method: {
      id: methodConfig.id,
      name: methodConfig.name,
      description: methodConfig.description,
      requiredFields: methodConfig.requiredFields,
    },
    options: options.map((opt) => ({
      optionId: opt.optionId,
      name: opt.name,
      currency: opt.currency,
      requiredAmount: opt.requiredAmount,
      payoutValue: opt.payoutValue,
      payoutCurrency: opt.payoutCurrency,
      sortOrder: opt.sortOrder,
    })),
  };
};

export const validatePayoutDetails = (methodId, details = {}) => {
  const methodConfig = PAYOUT_METHODS[methodId];
  if (!methodConfig) {
    throw new AppError('This payout method is currently unavailable.', 503, 'INACTIVE_PAYOUT_METHOD');
  }

  const sanitized = {};

  // Strip unknown keys and validate required fields.
  for (const field of methodConfig.requiredFields) {
    const value = details[field];
    if (!value || typeof value !== 'string' || !value.trim()) {
      throw new AppError(`Missing required field: ${field}`, 400, 'VALIDATION_ERROR');
    }

    const trimmedValue = value.trim();
    const rule = methodConfig.validation?.[field];

    if (rule?.regex && !rule.regex.test(trimmedValue)) {
      throw new AppError(rule.errorMessage || `Invalid ${field}`, 400, 'VALIDATION_ERROR');
    }

    sanitized[field] = trimmedValue;
  }

  return sanitized;
};

export const resolvePayoutOption = async (optionId, session = null) => {
  const query = PayoutOption.findOne({ optionId, active: true });
  if (session) query.session(session);

  const option = await query;
  if (!option) {
    throw new AppError('Selected payout option is unavailable.', 400, 'INVALID_PAYOUT_OPTION');
  }

  return option;
};

export const updatePayoutOption = async (optionId, updateData, adminId, ip = '') => {
  if (
    updateData.optionId !== undefined ||
    updateData.method !== undefined ||
    updateData.currency !== undefined
  ) {
    throw new AppError('Changing optionId, method, or currency is not allowed', 400, 'VALIDATION_ERROR');
  }

  const sanitizedUpdate = {};

  if (updateData.active !== undefined) {
    if (typeof updateData.active !== 'boolean') {
      throw new AppError('active must be a boolean', 400, 'VALIDATION_ERROR');
    }
    sanitizedUpdate.active = updateData.active;
  }

  if (updateData.requiredAmount !== undefined) {
    if (!Number.isInteger(updateData.requiredAmount) || updateData.requiredAmount <= 0) {
      throw new AppError('requiredAmount must be a positive integer', 400, 'VALIDATION_ERROR');
    }
    sanitizedUpdate.requiredAmount = updateData.requiredAmount;
  }

  if (updateData.payoutValue !== undefined) {
    if (typeof updateData.payoutValue !== 'number' || isNaN(updateData.payoutValue) || updateData.payoutValue <= 0) {
      throw new AppError('payoutValue must be a positive number', 400, 'VALIDATION_ERROR');
    }
    sanitizedUpdate.payoutValue = updateData.payoutValue;
  }

  if (updateData.sortOrder !== undefined) {
    if (!Number.isInteger(updateData.sortOrder) || updateData.sortOrder < 0) {
      throw new AppError('sortOrder must be a non-negative integer', 400, 'VALIDATION_ERROR');
    }
    sanitizedUpdate.sortOrder = updateData.sortOrder;
  }

  if (updateData.name !== undefined) {
    if (typeof updateData.name !== 'string' || !updateData.name.trim()) {
      throw new AppError('name must be a non-empty string', 400, 'VALIDATION_ERROR');
    }
    sanitizedUpdate.name = updateData.name.trim();
  }

  if (Object.keys(sanitizedUpdate).length === 0) {
    throw new AppError('No valid update fields provided', 400, 'VALIDATION_ERROR');
  }

  return withTransaction(async (session) => {
    const existingOption = await PayoutOption.findOne({ optionId }).session(session);
    if (!existingOption) {
      throw new AppError('Payout option not found', 404, 'NOT_FOUND');
    }

    const beforeObj = existingOption.toObject ? existingOption.toObject() : existingOption;

    const updated = await PayoutOption.findOneAndUpdate(
      { optionId },
      { $set: sanitizedUpdate },
      { new: true, session }
    );

    const afterObj = updated.toObject ? updated.toObject() : updated;

    await recordAuditLog({
      actorId: adminId,
      action: AUDIT_ACTIONS.PAYOUT_CONFIG_CHANGED,
      targetType: 'PAYOUT_OPTION',
      referenceId: optionId,
      metadata: {
        before: beforeObj,
        after: afterObj,
        changes: sanitizedUpdate,
      },
      ip,
      session,
    });

    return updated;
  });
};

export default {
  getPayoutMethods,
  getOptionsByMethod,
  validatePayoutDetails,
  resolvePayoutOption,
  updatePayoutOption,
};
