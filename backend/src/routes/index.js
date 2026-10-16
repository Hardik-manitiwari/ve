import express from 'express';
import authRoutes from './authRoutes.js';
import walletRoutes from './walletRoutes.js';
import rewardRoutes from './rewardRoutes.js';
import payoutRoutes from './payoutRoutes.js';
import withdrawalRoutes from './withdrawalRoutes.js';
import adminRoutes from './adminRoutes.js';
import mongoose from 'mongoose';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbState === 1,
      readyState: dbState,
      replicaSet: mongoose.connection.client?.options?.replicaSet || 'rs0',
    },
  });
});

// Mount modules under /api
router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/rewards', rewardRoutes);
router.use('/payout', payoutRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/admin', adminRoutes);

export default router;
