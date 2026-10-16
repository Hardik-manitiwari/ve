import { asyncHandler } from '../utils/asyncHandler.js';
import { claimDailyReward, claimAdReward, getRewardStatus } from '../services/rewardService.js';

/**
 * Claim daily login reward (+100 VEs once per UTC day)
 * POST /api/rewards/daily
 */
export const claimDaily = asyncHandler(async (req, res) => {
  const result = await claimDailyReward(req.user._id);

  res.status(200).json({
    success: true,
    message: `Daily reward claimed! +${result.amount} ${result.currency}`,
    data: result,
  });
});

/**
 * Claim ad watch reward (+100 VEs, max 10 per UTC day)
 * POST /api/rewards/ad
 */
export const claimAd = asyncHandler(async (req, res) => {
  const result = await claimAdReward(req.user._id);

  res.status(200).json({
    success: true,
    message: `Ad reward claimed! +${result.amount} ${result.currency} (${result.remainingToday} remaining today)`,
    data: result,
  });
});

/**
 * Get user reward status for today
 * GET /api/rewards/status
 */
export const getStatus = asyncHandler(async (req, res) => {
  const status = await getRewardStatus(req.user._id);

  res.status(200).json({
    success: true,
    data: status,
  });
});

export default {
  claimDaily,
  claimAd,
  getStatus,
};
