import { asyncHandler } from '../utils/asyncHandler.js';
import { getWallet, getSummary, getTransactions } from '../services/walletService.js';
import { reconcileUserWallet } from '../services/reconciliationService.js';

/**
 * Get current authenticated user's wallet
 * GET /api/wallet
 */
export const getUserWallet = asyncHandler(async (req, res) => {
  const wallet = await getWallet(req.user._id);

  res.status(200).json({
    success: true,
    data: wallet,
  });
});

/**
 * Get wallet summary
 * GET /api/wallet/summary
 */
export const getUserWalletSummary = asyncHandler(async (req, res) => {
  const summary = await getSummary(req.user._id);

  res.status(200).json({
    success: true,
    data: summary,
  });
});

/**
 * Get paginated transaction history
 * GET /api/wallet/transactions
 */
export const getUserTransactions = asyncHandler(async (req, res) => {
  const { page, limit, currency } = req.query;
  const result = await getTransactions(req.user._id, { page, limit, currency });

  res.status(200).json({
    success: true,
    data: result.items,
    pagination: result.pagination,
  });
});

/**
 * Reconcile current user's wallet against append-only ledger
 * GET /api/wallet/reconcile
 */
export const reconcileWallet = asyncHandler(async (req, res) => {
  const result = await reconcileUserWallet(req.user._id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export default {
  getUserWallet,
  getUserWalletSummary,
  getUserTransactions,
  reconcileWallet,
};
