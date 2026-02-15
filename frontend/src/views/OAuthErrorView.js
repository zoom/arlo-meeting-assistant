import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import './OAuthErrorView.css';

function getErrorMessage(error) {
  switch (error) {
    case 'access_denied':
      return "We couldn't connect to your Zoom account. This may happen if the authorization was denied or expired.";
    case 'invalid_code':
      return 'The authorization code is invalid or has expired. Please try again.';
    case 'token_exchange_failed':
      return "We couldn't complete the connection to Zoom. The authorization code may have expired.";
    case 'server_error':
      return 'An unexpected error occurred on our servers. Please try again later.';
    case 'missing_code':
      return 'No authorization code was received from Zoom. Please try again.';
    default:
      return "We couldn't connect to your Zoom account. This may happen if the authorization was denied or expired.";
  }
}

export default function OAuthErrorView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const errorCode = searchParams.get('error') || 'unknown';
  const customMessage = searchParams.get('message');
  const displayMessage = customMessage || getErrorMessage(errorCode);

  return (
    <div className="oauth-error-view">
      <div className="oauth-error-content">
        {/* Error Icon */}
        <div className="oauth-error-icon-wrapper">
          <div className="oauth-error-icon-circle">
            <AlertCircle size={40} className="oauth-error-icon" />
          </div>
        </div>

        {/* Heading */}
        <div className="oauth-error-heading">
          <h1 className="text-serif oauth-error-title">Authentication Failed</h1>
          <p className="text-sans text-muted" style={{ lineHeight: 1.625 }}>
            {displayMessage}
          </p>
        </div>

        {/* Actions */}
        <div className="oauth-error-actions">
          <Button variant="default" size="lg" onClick={() => { window.location.href = '/api/auth/start'; }}>
            Try Again
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate('/')}>
            Go to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
