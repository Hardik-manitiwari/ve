import mongoose from 'mongoose';

const dailyClaimSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dayKey: {
      type: String, // format: YYYY-MM-DD in UTC
      required: true,
    },
    rewardType: {
      type: String,
      default: 'DAILY_REWARD',
    },
    amount: {
      type: Number,
      default: 100,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Enforce strictly once per UTC day
dailyClaimSchema.index({ userId: 1, dayKey: 1 }, { unique: true });

export const DailyClaim = mongoose.model('DailyClaim', dailyClaimSchema);
export default DailyClaim;
