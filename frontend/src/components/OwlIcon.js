import React from 'react';

export default function OwlIcon({ size = 24, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="12" cy="12" r="8" fill="currentColor" />
      <circle cx="9" cy="11" r="2.5" fill="var(--background)" />
      <circle cx="15" cy="11" r="2.5" fill="var(--background)" />
      <circle cx="9" cy="11" r="1" fill="currentColor" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <path
        d="M 10 15 Q 12 16 14 15"
        stroke="var(--background)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M 4 8 L 6 10 L 5 11 Z" fill="currentColor" />
      <path d="M 20 8 L 18 10 L 19 11 Z" fill="currentColor" />
    </svg>
  );
}
