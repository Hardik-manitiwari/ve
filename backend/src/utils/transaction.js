import mongoose from 'mongoose';

/**
 * Execute work inside a MongoDB transaction.
 * If an active session is provided in options, reuses it without starting a nested transaction.
 *
 * @param {Function} workFn - async (session) => result
 * @param {Object} options - { existingSession }
 * @returns {Promise<any>}
 */
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
