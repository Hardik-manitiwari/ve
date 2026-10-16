import mongoose from 'mongoose';

const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // auto TTL 24 hours
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

export const IdempotencyKey = mongoose.model('IdempotencyKey', idempotencyKeySchema);
export default IdempotencyKey;
