import React from 'react';

export const BalanceCard = ({
  currency,
  amount = 0,
  isMain = false,
  description,
  onAction,
  actionLabel,
}) => {
  const configs = {
    VEs: {
      name: 'VEs (Core Rewards)',
      icon: '🟡',
      colorClass: 've-card',
      accentColor: 'var(--ve-gold)',
      desc: 'Redeemable currency for UPI cash transfers & vouchers',
    },
    SVEs: {
      name: 'SVEs (Special VEs)',
      icon: '💎',
      colorClass: 'sve-card',
      accentColor: 'var(--sve-cyan)',
      desc: 'Exclusive high-tier reward points for VIP challenges',
    },
    Gems: {
      name: 'Gems',
      icon: '♦️',
      colorClass: 'gem-card',
      accentColor: 'var(--gem-ruby)',
      desc: 'In-app currency to unlock powerups and entries',
    },
    Tokens: {
      name: 'Tokens',
      icon: '🪙',
      colorClass: 'token-card',
      accentColor: 'var(--token-emerald)',
      desc: 'Arcade and tournament entry passes',
    },
    Spins: {
      name: 'Lucky Spins',
      icon: '🎡',
      colorClass: 'spin-card',
      accentColor: 'var(--spin-purple)',
      desc: 'Instant spins on the daily mystery prize wheel',
    },
  };

  const current = configs[currency] || {
    name: currency,
    icon: '💰',
    colorClass: '',
    accentColor: 'var(--accent-primary)',
    desc: '',
  };

  return (
    <div className={`card balance-card ${current.colorClass} ${isMain ? 'balance-ve-main' : ''}`}>
      <div>
        <div className="balance-header">
          <span className="balance-title">{current.name}</span>
          <span className="balance-icon">{current.icon}</span>
        </div>
        <div className="balance-amount" style={{ color: current.accentColor }}>
          {amount?.toLocaleString() ?? 0}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
          {description || current.desc}
        </p>
      </div>

      {actionLabel && onAction && (
        <div style={{ marginTop: '1.25rem' }}>
          <button
            onClick={onAction}
            className={`btn btn-sm ${isMain ? 'btn-primary' : 'btn-secondary'}`}
            style={{ width: '100%' }}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
};

export default BalanceCard;
