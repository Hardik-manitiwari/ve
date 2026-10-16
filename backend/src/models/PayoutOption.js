import mongoose from 'mongoose';

const payoutOptionSchema = new mongoose.Schema(
  {
    optionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    method: {
      type: String,
      required: true,
      index: true,
    },
    name: {
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
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

payoutOptionSchema.index({ method: 1, active: 1, sortOrder: 1 });

export const PayoutOption = mongoose.model('PayoutOption', payoutOptionSchema);
export default PayoutOption;
