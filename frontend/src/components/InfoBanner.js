import React from 'react';
import { Info, X } from 'lucide-react';
import './InfoBanner.css';

export default function InfoBanner({ message, onDismiss }) {
  return (
    <div className="info-banner">
      <Info size={16} className="info-banner-icon" />
      <p className="text-sans text-sm info-banner-text">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="info-banner-dismiss">
          <X size={16} />
        </button>
      )}
    </div>
  );
}
