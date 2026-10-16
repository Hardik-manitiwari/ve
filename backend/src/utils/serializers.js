/**
 * Mask sensitive values like UPI ID or email.
 * e.g., 'naveen@okaxis' -> 'na****@okaxis'
 * e.g., 'john.doe@example.com' -> 'jo****@example.com'
 */
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

  // Fallback for non-email/UPI strings
  if (value.length <= 4) return '****';
  return `${value.substring(0, 2)}****${value.substring(value.length - 2)}`;
};

/**
 * Mask sensitive fields in payoutDetails
 */
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

/**
 * Serialize a withdrawal object for API responses
 */
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
