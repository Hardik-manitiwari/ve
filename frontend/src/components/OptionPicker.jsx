import React from 'react';

export const OptionPicker = ({
  options = [],
  selectedOptionId,
  userBalance = 0,
  onSelectOption,
}) => {
  return (
    <div className="payout-options-grid">
      {options.map((option) => {
        const isSelected = selectedOptionId === option.optionId;
        const canAfford = userBalance >= option.requiredAmount;
        const difference = option.requiredAmount - userBalance;

        return (
          <div
            key={option.optionId}
            className={`card payout-option-card ${isSelected ? 'selected' : ''} ${!canAfford ? 'disabled' : ''}`}
            onClick={() => canAfford && onSelectOption(option)}
            title={canAfford ? 'Click to select denomination' : `Need ${difference.toLocaleString()} more VEs`}
          >
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)', marginBottom: '0.25rem' }}>
              ₹{option.payoutValue}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              {option.name}
            </div>

            <div
              style={{
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.5rem',
                border: '1px solid var(--border-glass)',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Required</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--ve-gold)' }}>
                {option.requiredAmount?.toLocaleString()} VEs
              </div>
            </div>

            {!canAfford && (
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.7rem',
                  color: 'var(--danger)',
                  fontWeight: 600,
                }}
              >
                Needs +{difference?.toLocaleString()} VEs
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default OptionPicker;
