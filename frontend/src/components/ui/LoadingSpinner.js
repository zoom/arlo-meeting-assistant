import React from 'react';
import './LoadingSpinner.css';

export default function LoadingSpinner({ size = 32, className = '' }) {
  return (
    <div
      className={`loading-spinner ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}
