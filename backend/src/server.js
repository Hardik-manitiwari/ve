import app from './app.js';
import config from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(config.PORT, () => {
      console.log(`[VELoop Wallet Backend] Server is running on port ${config.PORT} (${config.NODE_ENV})`);
      console.log(`[VELoop Wallet Backend] Replica set URI: ${config.MONGO_URI}`);
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
  } catch (error) {
    console.error('[VELoop Wallet Backend] Fatal error during startup:', error);
    process.exit(1);
  }
};

startServer();
