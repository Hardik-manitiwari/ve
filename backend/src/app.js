import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/AppError.js';
import { apiLimiter } from './middleware/rateLimit.js';

const app = express();

// Security HTTP headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: config.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// Body parser with 10 KB payload restriction
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Apply rate limiting to all requests (except in test mode)
if (config.NODE_ENV !== 'test') {
  app.use('/api', apiLimiter);
}

// Mount all API endpoints under /api
app.use('/api', apiRoutes);

// Catch-all for undefined routes
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404, 'NOT_FOUND'));
});

// Centralized operational error handler
app.use(errorHandler);

export default app;
