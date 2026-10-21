import { asyncHandler } from '../utils/asyncHandler.js';
import { claimDailyReward, claimAdReward, getRewardStatus } from '../services/rewardService.js';

export const claimDaily = asyncHandler(async (req, res) => {
  const result = await claimDailyReward(req.user._id);

  res.status(200).json({
    success: true,
    message: `Daily reward claimed! +${result.amount} ${result.currency}`,
    data: result,
  });
});

export const claimAd = asyncHandler(async (req, res) => {
  const result = await claimAdReward(req.user._id);

  res.status(200).json({
    success: true,
    message: `Ad reward claimed! +${result.amount} ${result.currency} (${result.remainingToday} remaining today)`,
    data: result,
  });
});

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
