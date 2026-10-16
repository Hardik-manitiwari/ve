export const PAYOUT_METHODS = {
  upi: {
    id: 'upi',
    name: 'UPI Payout',
    description: 'Instant transfer to your Virtual Payment Address (UPI VPA)',
    payoutCurrency: 'INR',
    requiredFields: ['upiId'],
    validation: {
      upiId: {
        regex: /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/,
        errorMessage: 'Invalid UPI ID format. Must be e.g. username@bank',
      },
    },
    active: true,
  },
  amazon: {
    id: 'amazon',
    name: 'Amazon Gift Card',
    description: 'Digital gift card delivered directly to your email',
    payoutCurrency: 'INR',
    requiredFields: ['email'],
    validation: {
      email: {
        regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        errorMessage: 'Invalid email address format.',
      },
    },
    active: false, // Amazon has no active options initially
  },
  google_play: {
    id: 'google_play',
    name: 'Google Play Gift Card',
    description: 'Redeem code delivered directly to your email',
    payoutCurrency: 'INR',
    requiredFields: ['email'],
    validation: {
      email: {
        regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        errorMessage: 'Invalid email address format.',
      },
    },
    active: false, // Google Play has no active options initially
  },
};

export default PAYOUT_METHODS;
