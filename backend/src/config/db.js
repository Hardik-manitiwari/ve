import mongoose from 'mongoose';
import config from './env.js';

let isConnected = false;

export const connectDB = async (customUri) => {
  const uri = customUri || config.MONGO_URI;

  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      autoIndex: true,
    });

    isConnected = true;
    if (config.NODE_ENV !== 'test') {
      console.log(`[MongoDB] Connected successfully to ${conn.connection.host}/${conn.connection.name}`);
    }
    return conn.connection;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    throw error;
  }
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
  }
};

export default { connectDB, disconnectDB };
