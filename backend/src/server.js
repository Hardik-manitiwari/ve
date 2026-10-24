import app from './app.js';
import config from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

const startServer = () => {
  const server = app.listen(config.PORT, () => {
    console.log(`[VELoop Wallet Backend] Server is running on port ${config.PORT} (${config.NODE_ENV})`);
  });

  // Connect in the background so the health check can respond while the database connects.
  connectDB().catch((error) => {
    console.error('[VELoop Wallet Backend] MongoDB connection failed:', error.message);
  });

  const shutdown = async (signal) => {
    console.log(`\n[VELoop Wallet Backend] ${signal} signal received: closing HTTP server...`);
    server.close(async () => {
      console.log('[VELoop Wallet Backend] HTTP server closed.');
      await disconnectDB();
      console.log('[VELoop Wallet Backend] MongoDB connection closed. Exiting process.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

startServer();