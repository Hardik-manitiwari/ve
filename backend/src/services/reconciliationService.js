import { WalletTransaction } from '../models/WalletTransaction.js';
import { Wallet } from '../models/Wallet.js';
import { CURRENCIES, TRANSACTION_TYPES } from '../config/constants.js';
import { ensureWallet } from './walletService.js';

/**
 * Reconcile a user's wallet against the immutable append-only ledger.
 * Computes sum(CREDIT) - sum(DEBIT) per currency and compares to wallet.
 */
export const reconcileUserWallet = async (userId) => {
  // 1. Get current wallet state
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await ensureWallet(userId);
  }

  // 2. Aggregate transactions from ledger grouped by currency and type
  const ledgerAggregation = await WalletTransaction.aggregate([
    { $match: { userId: wallet.userId } },
    {
      $group: {
        _id: { currency: '$currency', type: '$type' },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Map sums
  const currencyData = {};
  CURRENCIES.forEach((currency) => {
    currencyData[currency] = {
      credits: 0,
      debits: 0,
      creditCount: 0,
      debitCount: 0,
    };
  });

  ledgerAggregation.forEach((row) => {
    const currency = row._id.currency;
    const type = row._id.type;
    if (currencyData[currency]) {
      if (type === TRANSACTION_TYPES.CREDIT) {
        currencyData[currency].credits = row.totalAmount;
        currencyData[currency].creditCount = row.count;
      } else if (type === TRANSACTION_TYPES.DEBIT) {
        currencyData[currency].debits = row.totalAmount;
        currencyData[currency].debitCount = row.count;
      }
    }
  });

  let allMatch = true;
  const perCurrency = {};

  CURRENCIES.forEach((currency) => {
    const credits = currencyData[currency].credits;
    const debits = currencyData[currency].debits;
    const ledgerBalance = credits - debits;
    const walletBalance = wallet[currency] || 0;
    const matches = ledgerBalance === walletBalance;

    if (!matches) {
      allMatch = false;
    }

    perCurrency[currency] = {
      ledgerBalance,
      walletBalance,
      matches,
      credits,
      debits,
      difference: walletBalance - ledgerBalance,
      creditTransactions: currencyData[currency].creditCount,
      debitTransactions: currencyData[currency].debitCount,
    };
  });

  return {
    userId: wallet.userId,
    matches: allMatch,
    reconciledAt: new Date(),
    perCurrency,
  };
};

export default {
  reconcileUserWallet,
};
