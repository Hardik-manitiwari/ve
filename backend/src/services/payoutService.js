import { PayoutOption } from '../models/PayoutOption.js';
import { PAYOUT_METHODS } from '../config/payoutMethods.js';
import { AUDIT_ACTIONS } from '../config/constants.js';
import { AppError } from '../utils/AppError.js';
import { recordAuditLog } from './auditService.js';

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
  const allowedUpdates = ['name', 'requiredAmount', 'payoutValue', 'active', 'sortOrder'];
  const sanitizedUpdate = {};

  for (const key of allowedUpdates) {
    if (updateData[key] !== undefined) {
      sanitizedUpdate[key] = updateData[key];
    }
  }

  if (Object.keys(sanitizedUpdate).length === 0) {
    throw new AppError('No valid update fields provided', 400, 'VALIDATION_ERROR');
  }

  const existingOption = await PayoutOption.findOne({ optionId });
  if (!existingOption) {
    throw new AppError('Payout option not found', 404, 'NOT_FOUND');
  }

  const updated = await PayoutOption.findOneAndUpdate(
    { optionId },
    { $set: sanitizedUpdate },
    { new: true }
  );

  await recordAuditLog({
    actorId: adminId,
    action: AUDIT_ACTIONS.PAYOUT_CONFIG_CHANGED,
    targetType: 'PAYOUT_OPTION',
    referenceId: optionId,
    metadata: {
      before: existingOption.toObject(),
      after: updated.toObject(),
      changes: sanitizedUpdate,
    },
    ip,
  });

  return updated;
};

export default {
  getPayoutMethods,
  getOptionsByMethod,
  validatePayoutDetails,
  resolvePayoutOption,
  updatePayoutOption,
};
