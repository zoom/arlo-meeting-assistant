import React from 'react';
import './Button.css';

export default function Button({
  children,
  variant = 'default',
  size = 'default',
  className = '',
  disabled,
  ...props
}) {
  return (
    <button
      className={`btn btn-${variant} btn-size-${size} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
