import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import './OAuthErrorView.css';

const ERROR_MESSAGES = {
  access_denied: 'The authorization was denied. You need to approve access for Arlo to connect to your Zoom account.',
  missing_code: 'No authorization code was received from Zoom. Please try again.',
  token_exchange_failed: 'We couldn\'t complete the connection to Zoom. The authorization code may have expired.',
  server_error: 'Something went wrong on our end. Please try again.',
};

export default function OAuthErrorView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const errorCode = searchParams.get('error') || 'unknown';
  const customMessage = searchParams.get('message');
  const displayMessage = customMessage || ERROR_MESSAGES[errorCode] ||
    'We couldn\'t connect to your Zoom account. This may happen if the authorization was denied or expired.';

  return (
    <div className="oauth-error-view">
      <div className="oauth-error-content">
        <AlertCircle size={64} className="oauth-error-icon" />

        <div className="oauth-error-heading">
          <h1 className="text-serif text-2xl">Authentication Failed</h1>
          <p className="text-muted">{displayMessage}</p>
        </div>

        <div className="oauth-error-actions">
          <Button variant="accent" size="lg" onClick={() => { window.location.href = '/api/auth/start'; }}>
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
