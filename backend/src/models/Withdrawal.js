import mongoose from 'mongoose';
import { WITHDRAWAL_STATUSES } from '../config/constants.js';

const withdrawalSchema = new mongoose.Schema(
  {
    withdrawalId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
    },
    optionId: {
      type: String,
      required: true,
    },
    method: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'VEs',
    },
    requiredAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    payoutValue: {
      type: Number,
      required: true,
      min: 0,
    },
    payoutCurrency: {
      type: String,
      required: true,
      default: 'INR',
    },
    payoutDetails: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(WITHDRAWAL_STATUSES),
      default: WITHDRAWAL_STATUSES.PENDING,
      index: true,
    },
    reviewNotes: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Idempotency composite unique index
withdrawalSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
withdrawalSchema.index({ userId: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

export const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;
