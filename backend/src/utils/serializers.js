// Masks handles like naveen@okaxis into na****@okaxis.
export const maskSensitiveValue = (value) => {
  if (!value || typeof value !== 'string') return value;

  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    if (local.length <= 2) {
      return `${local[0] || ''}****@${domain}`;
    }
    const visiblePrefix = local.substring(0, 2);
    return `${visiblePrefix}****@${domain}`;
  }

  if (value.length <= 4) return '****';
  return `${value.substring(0, 2)}****${value.substring(value.length - 2)}`;
};

export const maskPayoutDetails = (payoutDetails) => {
  if (!payoutDetails || typeof payoutDetails !== 'object') return {};

  const masked = { ...payoutDetails };
  if (masked.upiId) {
    masked.upiId = maskSensitiveValue(masked.upiId);
  }
  if (masked.email) {
    masked.email = maskSensitiveValue(masked.email);
  }
  return masked;
};

export const serializeWithdrawal = (withdrawal) => {
  if (!withdrawal) return null;
  const doc = withdrawal.toObject ? withdrawal.toObject() : { ...withdrawal };

  return {
    id: doc._id?.toString() || doc.id,
    withdrawalId: doc.withdrawalId || doc._id?.toString(),
    userId: doc.userId,
    optionId: doc.optionId,
    method: doc.method,
    currency: doc.currency,
    requiredAmount: doc.requiredAmount,
    payoutValue: doc.payoutValue,
    payoutCurrency: doc.payoutCurrency,
    payoutDetails: maskPayoutDetails(doc.payoutDetails),
    status: doc.status,
    idempotencyKey: doc.idempotencyKey,
    reviewNotes: doc.reviewNotes,
    reviewedAt: doc.reviewedAt,
    reviewedBy: doc.reviewedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

export default {
  maskSensitiveValue,
  maskPayoutDetails,
  serializeWithdrawal,
};
