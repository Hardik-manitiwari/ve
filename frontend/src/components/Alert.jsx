import React from 'react';

export const Alert = ({ type = 'info', children, onClose }) => {
  const icons = {
    danger: '⚠️',
    success: '✅',
    info: 'ℹ️',
    warning: '⚡',
  };

  return (
    <div className={`alert alert-${type}`}>
      <span style={{ fontSize: '1.2rem' }}>{icons[type] || 'ℹ️'}</span>
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '0 0.25rem',
          }}
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default Alert;
