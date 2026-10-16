import { AuditLog } from '../models/AuditLog.js';

/**
 * Record an audit log entry within an optional MongoDB session.
 */
export const recordAuditLog = async ({
  actorId,
  action,
  targetUserId,
  targetType = 'WALLET',
  referenceId,
  metadata = {},
  ip = '',
  session = null,
}) => {
  const logData = {
    actorId: actorId?.toString() || 'SYSTEM',
    action,
    targetUserId: targetUserId?.toString() || null,
    targetType,
    referenceId: referenceId?.toString() || null,
    metadata,
    ip: ip || '',
    createdAt: new Date(),
  };

  if (session) {
    const logs = await AuditLog.create([logData], { session });
    return logs[0];
  }

  return AuditLog.create(logData);
};

export default {
  recordAuditLog,
};
