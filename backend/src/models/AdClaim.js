import mongoose from 'mongoose';

const adClaimSchema = new mongoose.Schema(
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
    count: {
      type: Number,
      default: 1,
    },
    lastClaimedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

adClaimSchema.index({ userId: 1, dayKey: 1 }, { unique: true });

export const AdClaim = mongoose.model('AdClaim', adClaimSchema);
export default AdClaim;
