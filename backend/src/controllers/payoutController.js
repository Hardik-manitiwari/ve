import { asyncHandler } from '../utils/asyncHandler.js';
import { getPayoutMethods, getOptionsByMethod } from '../services/payoutService.js';

/**
 * Get all payout methods
 * GET /api/payout/methods
 */
export const getMethods = asyncHandler(async (req, res) => {
  const methods = await getPayoutMethods();

  res.status(200).json({
    success: true,
    data: methods,
  });
});

/**
 * Get active options for a specific payout method
 * GET /api/payout/options/:method
 */
export const getOptions = asyncHandler(async (req, res) => {
  const { method } = req.params;
  const result = await getOptionsByMethod(method);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export default {
  getMethods,
  getOptions,
};
