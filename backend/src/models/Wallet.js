import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    VEs: {
      type: Number,
      default: 0,
      min: [0, 'VEs balance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'VEs must be an integer',
      },
    },
    SVEs: {
      type: Number,
      default: 0,
      min: [0, 'SVEs balance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'SVEs must be an integer',
      },
    },
    Gems: {
      type: Number,
      default: 0,
      min: [0, 'Gems balance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Gems must be an integer',
      },
    },
    Tokens: {
      type: Number,
      default: 0,
      min: [0, 'Tokens balance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Tokens must be an integer',
      },
    },
    Spins: {
      type: Number,
      default: 0,
      min: [0, 'Spins balance cannot be negative'],
      validate: {
        validator: Number.isInteger,
        message: 'Spins must be an integer',
      },
    },
  },
  {
    timestamps: true,
  }
);

export const Wallet = mongoose.model('Wallet', walletSchema);
export default Wallet;
