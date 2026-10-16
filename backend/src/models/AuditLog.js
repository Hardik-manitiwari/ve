import mongoose from 'mongoose';
import { AUDIT_ACTIONS } from '../config/constants.js';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: Object.values(AUDIT_ACTIONS),
    },
    targetUserId: {
      type: String,
    },
    targetType: {
      type: String,
      default: 'WALLET',
    },
    referenceId: {
      type: String,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

auditLogSchema.index({ targetUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
