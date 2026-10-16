import rateLimit from 'express-rate-limit';
import config from '../config/env.js';

const isTest = config.NODE_ENV === 'test';

/**
 * Standard error response for rate limiting
 */
const rateLimitHandler = (message, code = 'RATE_LIMIT_EXCEEDED') => (req, res) => {
  res.status(429).json({
    success: false,
    message,
    code,
  });
};

/**
 * Auth rate limit: 20 per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 20,
  handler: rateLimitHandler('Too many authentication attempts. Please try again after 15 minutes.'),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Withdrawal creation: 10 per hour per user
 */
export const withdrawalCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTest ? 1000 : 10,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  handler: rateLimitHandler('Withdrawal request limit reached (10 per hour). Please try again later.'),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Wallet mutations: 30 per minute
 */
export const walletMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 1000 : 30,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  handler: rateLimitHandler('Too many wallet operations. Please wait a moment before trying again.'),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API limiter: 120 per minute
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 5000 : 120,
  handler: rateLimitHandler('Rate limit exceeded. Please slow down.'),
  standardHeaders: true,
  legacyHeaders: false,
});

export default {
  authLimiter,
  withdrawalCreationLimiter,
  walletMutationLimiter,
  apiLimiter,
};
