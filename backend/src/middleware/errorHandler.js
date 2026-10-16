import { AppError } from '../utils/AppError.js';
import config from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Mongoose / MongoDB specific errors
  if (err.name === 'CastError') {
    error = new AppError(`Invalid resource identifier: ${err.value}`, 400, 'INVALID_ID');
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new AppError(`Duplicate entry for ${field}.`, 409, 'DUPLICATE_KEY');
  } else if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    error = new AppError(messages[0] || 'Validation error', 400, 'VALIDATION_ERROR');
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  } else if (err.type === 'entity.too.large') {
    error = new AppError('Request payload too large.', 413, 'PAYLOAD_TOO_LARGE');
  }

  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational || false;
  const message = isOperational ? error.message : 'Internal server error';
  const code = isOperational ? (error.code || 'ERROR') : 'INTERNAL_ERROR';

  if (!isOperational && config.NODE_ENV !== 'test') {
    console.error('[UNHANDLED_ERROR]', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
};

export default errorHandler;
