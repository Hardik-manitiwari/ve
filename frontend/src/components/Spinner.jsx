import React from 'react';

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizeClass = size === 'lg' ? 'spinner-lg' : size === 'sm' ? 'spinner-sm' : '';
  return <span className={`spinner ${sizeClass} ${className}`} aria-label="Loading" />;
};

export default Spinner;
