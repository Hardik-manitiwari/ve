import React from 'react';

export const StatusBadge = ({ status }) => {
  const normStatus = (status || '').toUpperCase();

  const config = {
    PENDING: { label: 'Pending', className: 'badge-pending', icon: '⏳' },
    PROCESSING: { label: 'Processing', className: 'badge-processing', icon: '⚙️' },
    APPROVED: { label: 'Approved', className: 'badge-approved', icon: '✓' },
    REJECTED: { label: 'Rejected', className: 'badge-rejected', icon: '✕' },
    CANCELLED: { label: 'Cancelled', className: 'badge-cancelled', icon: '⊘' },
  };

  const current = config[normStatus] || {
    label: normStatus,
    className: 'badge-cancelled',
    icon: '•',
  };

  return (
    <span className={`badge ${current.className}`}>
      <span>{current.icon}</span>
      <span>{current.label}</span>
    </span>
  );
};

export default StatusBadge;
