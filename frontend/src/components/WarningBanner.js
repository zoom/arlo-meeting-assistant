import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './WarningBanner.css';

export default function WarningBanner({ message, onDismiss }) {
  return (
    <div className="warning-banner">
      <AlertTriangle size={16} className="warning-banner-icon" />
      <p className="text-sans text-sm warning-banner-text">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="warning-banner-dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
