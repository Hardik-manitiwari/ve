import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import config from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ensureWallet, getWallet } from '../services/walletService.js';

const signToken = (id) => {
  return jwt.sign({ id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
};

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400, 'VALIDATION_ERROR'));
  }

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    return next(new AppError('Email is already registered.', 409, 'EMAIL_EXISTS'));
  }

  const user = await User.create({
    email: email.toLowerCase().trim(),
    password,
  });

  // Ensure user has initial wallet
  await ensureWallet(user._id);

  const token = signToken(user._id);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    },
  });
});

/**
 * User login
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400, 'VALIDATION_ERROR'));
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return next(new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS'));
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return next(new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS'));
  }

  if (user.accountStatus !== 'active') {
    return next(new AppError('This request requires additional verification.', 403, 'ACCOUNT_SUSPENDED'));
  }

  const token = signToken(user._id);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    },
  });
});

/**
 * Get current user profile and wallet balances
 * GET /api/auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
  const wallet = await getWallet(req.user._id);

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        accountStatus: req.user.accountStatus,
        createdAt: req.user.createdAt,
      },
      wallet,
    },
  });
});

export default {
  register,
  login,
  getMe,
};
