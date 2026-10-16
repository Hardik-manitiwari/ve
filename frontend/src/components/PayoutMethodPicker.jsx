import React from 'react';

export const PayoutMethodPicker = ({
  methods = [],
  selectedMethodId,
  onSelectMethod,
}) => {
  const methodIcons = {
    upi: '⚡',
    amazon: '📦',
    google_play: '🎮',
  };

  return (
    <div className="payout-methods-grid">
      {methods.map((method) => {
        const isSelected = selectedMethodId === method.id;
        const isAvailable = method.available;

        return (
          <div
            key={method.id}
            className={`card payout-method-card ${isSelected ? 'selected' : ''}`}
            onClick={() => isAvailable && onSelectMethod(method.id)}
            style={{
              opacity: isAvailable ? 1 : 0.6,
              cursor: isAvailable ? 'pointer' : 'not-allowed',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.75rem' }}>{methodIcons[method.id] || '💳'}</span>
                <span
                  className="badge"
                  style={{
                    background: isAvailable ? 'var(--success-bg)' : 'rgba(100, 116, 139, 0.2)',
                    color: isAvailable ? 'var(--success)' : 'var(--text-muted)',
                    border: `1px solid ${isAvailable ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                  }}
                >
                  {isAvailable ? 'Active' : 'Unavailable'}
                </span>
              </div>
              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>{method.name}</h4>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                {method.description}
              </p>
            </div>

            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-glass)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {isAvailable ? 'Instant processing' : 'Currently no active vouchers'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PayoutMethodPicker;
