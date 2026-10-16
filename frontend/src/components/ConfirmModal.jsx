import React from 'react';
import Spinner from './Spinner.jsx';

export const ConfirmModal = ({
  isOpen,
  title = 'Confirm Redemption',
  payoutValue,
  payoutCurrency = 'INR',
  requiredAmount,
  currency = 'VEs',
  methodName,
  recipientDetail,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '1.75rem' }}>🎁</span>
          <h3 style={{ margin: 0, fontSize: '1.35rem' }}>{title}</h3>
        </div>

        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          Are you sure you want to redeem this reward?
        </p>

        <div
          style={{
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            border: '1px solid var(--border-glass)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Payout Value:</span>
            <strong style={{ color: 'var(--success)', fontSize: '1.1rem' }}>
              ₹{payoutValue} {payoutCurrency}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Required:</span>
            <strong style={{ color: 'var(--ve-gold)', fontSize: '1.1rem' }}>
              {requiredAmount?.toLocaleString()} {currency}
            </strong>
          </div>

          {methodName && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Method:</span>
              <span>{methodName}</span>
            </div>
          )}

          {recipientDetail && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Recipient:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{recipientDetail}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                <span>Processing...</span>
              </>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
