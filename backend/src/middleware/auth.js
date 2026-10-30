import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import config from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ACCOUNT_STATUSES } from '../config/constants.js';

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
  }

  // Look up user fresh from the database on each request.
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
  }

  if (currentUser.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    return next(
      new AppError('This request requires additional verification.', 403, 'ACCOUNT_SUSPENDED')
    );
  }

  req.user = currentUser;
  next();
});

export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('Access forbidden: insufficient permissions.', 403, 'FORBIDDEN')
      );
    }
    next();
  };
};

export const authenticate = protect;
export const requireRole = restrictTo;

export default {
  protect,
  restrictTo,
  authenticate,
  requireRole,
};
