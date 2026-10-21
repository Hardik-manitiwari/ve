import mongoose from 'mongoose';

// Runs a callback inside a MongoDB transaction, or reuses an existing session if passed.
export const withTransaction = async (workFn, options = {}) => {
  if (options.existingSession) {
    return workFn(options.existingSession);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await workFn(session);
    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' },
    });
    return result;
  } finally {
    await session.endSession();
  }
};

export default withTransaction;
