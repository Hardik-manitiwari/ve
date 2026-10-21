import { asyncHandler } from '../utils/asyncHandler.js';
import { getPayoutMethods, getOptionsByMethod } from '../services/payoutService.js';

export const getMethods = asyncHandler(async (req, res) => {
  const methods = await getPayoutMethods();

  res.status(200).json({
    success: true,
    data: methods,
  });
});

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
