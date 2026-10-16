import mongoose from 'mongoose';
import { CURRENCIES, TRANSACTION_TYPES, TRANSACTION_CATEGORIES } from '../config/constants.js';

const allCategories = [
  ...TRANSACTION_CATEGORIES.CREDIT,
  ...TRANSACTION_CATEGORIES.DEBIT,
];

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    currency: {
      type: String,
      required: true,
      enum: CURRENCIES,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(TRANSACTION_TYPES),
    },
    category: {
      type: String,
      required: true,
      enum: allCategories,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Amount must be a positive integer'],
      validate: {
        validator: Number.isInteger,
        message: 'Amount must be an integer',
      },
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: [0, 'Balance before cannot be negative'],
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: [0, 'Balance after cannot be negative'],
    },
    source: {
      type: String,
      required: true,
      default: 'SYSTEM',
    },
    referenceId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: 'COMPLETED',
    },
    description: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Required composite indexes
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ userId: 1, currency: 1, createdAt: -1 });
walletTransactionSchema.index({ referenceId: 1 });
walletTransactionSchema.index({ createdAt: -1 });

export const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
export default WalletTransaction;
