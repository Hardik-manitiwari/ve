import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import config from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { PayoutOption } from '../src/models/PayoutOption.js';
import { DEFAULT_PAYOUT_OPTIONS } from '../seed/payoutOptions.js';
import { ensureWallet } from '../src/services/walletService.js';

let replSet = null;

export const setupTestDB = async () => {
  // Use MongoMemoryReplSet as explicitly required by prompt
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = replSet.getUri();

  await mongoose.connect(uri, {
    autoIndex: true,
  });

  // Seed payout options
  for (const opt of DEFAULT_PAYOUT_OPTIONS) {
    await PayoutOption.create(opt);
  }
};

export const teardownTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
};

export const clearCollections = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    // Keep payout options for test cases
    if (key !== 'payoutoptions') {
      await collections[key].deleteMany({});
    }
  }
};

export const createTestUser = async (overrides = {}) => {
  const email = overrides.email || `user_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
  const role = overrides.role || 'user';
  const accountStatus = overrides.accountStatus || 'active';

  const user = await User.create({
    email,
    password: 'Password123!',
    role,
    accountStatus,
  });

  await ensureWallet(user._id);

  const token = jwt.sign({ id: user._id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });

  return {
    user,
    token,
    authHeader: `Bearer ${token}`,
  };
};

export default {
  setupTestDB,
  teardownTestDB,
  clearCollections,
  createTestUser,
};
