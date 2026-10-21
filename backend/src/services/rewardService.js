import { DailyClaim } from '../models/DailyClaim.js';
import { AdClaim } from '../models/AdClaim.js';
import { REWARDS } from '../config/constants.js';
import { AppError } from '../utils/AppError.js';
import { withTransaction } from '../utils/transaction.js';
import { creditWallet } from './walletService.js';

export const getUtcDayKey = () => {
  return new Date().toISOString().slice(0, 10);
};

export const claimDailyReward = async (userId) => {
  const dayKey = getUtcDayKey();
  const rewardConfig = REWARDS.DAILY_REWARD;

  const existing = await DailyClaim.findOne({ userId, dayKey });
  if (existing) {
    throw new AppError('Daily reward has already been claimed today.', 400, 'DAILY_REWARD_ALREADY_CLAIMED');
  }

  try {
    return await withTransaction(async (session) => {
      // Unique index on (userId, dayKey) in DailyClaim prevents duplicate claims for the UTC day.
      const [claim] = await DailyClaim.create(
        [
          {
            userId,
            dayKey,
            rewardType: rewardConfig.category,
            amount: rewardConfig.amount,
            claimedAt: new Date(),
          },
        ],
        { session }
      );

      const { wallet, transaction } = await creditWallet({
        userId,
        currency: rewardConfig.currency,
        amount: rewardConfig.amount,
        category: rewardConfig.category,
        referenceId: claim._id.toString(),
        source: 'SYSTEM',
        description: `Daily check-in reward (+${rewardConfig.amount} VEs) for ${dayKey}`,
        metadata: { dayKey },
        session,
      });

      return {
        claimed: true,
        amount: rewardConfig.amount,
        currency: rewardConfig.currency,
        dayKey,
        newBalance: wallet[rewardConfig.currency],
        transactionId: transaction.transactionId,
      };
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('Daily reward has already been claimed today.', 400, 'DAILY_REWARD_ALREADY_CLAIMED');
    }
    throw error;
  }
};

export const claimAdReward = async (userId) => {
  const dayKey = getUtcDayKey();
  const rewardConfig = REWARDS.AD_REWARD;
  const maxPerDay = rewardConfig.maxPerDay;

  return withTransaction(async (session) => {
    const adRecord = await AdClaim.findOne({ userId, dayKey }).session(session);
    if (adRecord && adRecord.count >= maxPerDay) {
      throw new AppError(
        `Maximum daily ad rewards reached (${maxPerDay}/${maxPerDay}). Come back tomorrow!`,
        429,
        'AD_REWARD_LIMIT_REACHED'
      );
    }

    // Atomic update with count check keeps concurrent clicks from exceeding the limit.
    const updated = await AdClaim.findOneAndUpdate(
      {
        userId,
        dayKey,
        ...(adRecord ? { count: { $lt: maxPerDay } } : {}),
      },
      {
        $inc: { count: 1 },
        $set: { lastClaimedAt: new Date() },
      },
      {
        upsert: !adRecord,
        new: true,
        session,
      }
    );

    if (!updated || updated.count > maxPerDay) {
      throw new AppError(
        `Maximum daily ad rewards reached (${maxPerDay}/${maxPerDay}).`,
        429,
        'AD_REWARD_LIMIT_REACHED'
      );
    }

    const { wallet, transaction } = await creditWallet({
      userId,
      currency: rewardConfig.currency,
      amount: rewardConfig.amount,
      category: rewardConfig.category,
      referenceId: `${dayKey}_ad_${updated.count}`,
      source: 'SYSTEM',
      description: `Watch ad reward #${updated.count}/${maxPerDay} (+${rewardConfig.amount} VEs)`,
      metadata: { dayKey, adNumber: updated.count },
      session,
    });

    return {
      claimed: true,
      amount: rewardConfig.amount,
      currency: rewardConfig.currency,
      dayKey,
      claimsToday: updated.count,
      remainingToday: maxPerDay - updated.count,
      newBalance: wallet[rewardConfig.currency],
      transactionId: transaction.transactionId,
    };
  });
};

export const getRewardStatus = async (userId) => {
  const dayKey = getUtcDayKey();
  const [dailyClaim, adClaim] = await Promise.all([
    DailyClaim.findOne({ userId, dayKey }).lean(),
    AdClaim.findOne({ userId, dayKey }).lean(),
  ]);

  return {
    dayKey,
    dailyReward: {
      claimedToday: Boolean(dailyClaim),
      claimedAt: dailyClaim?.claimedAt || null,
      amount: REWARDS.DAILY_REWARD.amount,
    },
    adReward: {
      claimsToday: adClaim?.count || 0,
      maxPerDay: REWARDS.AD_REWARD.maxPerDay,
      remainingToday: Math.max(0, REWARDS.AD_REWARD.maxPerDay - (adClaim?.count || 0)),
      amount: REWARDS.AD_REWARD.amount,
    },
  };
};

export default {
  claimDailyReward,
  claimAdReward,
  getRewardStatus,
  getUtcDayKey,
};
