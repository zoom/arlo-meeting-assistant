import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useZoomSdk } from '../contexts/ZoomSdkContext';
import useZoomAuth from '../hooks/useZoomAuth';
import OwlIcon from '../components/OwlIcon';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import './AuthView.css';

export default function AuthView() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, login } = useAuth();
  const { isTestMode } = useZoomSdk();
  const { authorize, isAuthorizing, error } = useZoomAuth();

  // Redirect if already authenticated (e.g. session restored from cookie)
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // In test mode, allow bypass
  useEffect(() => {
    if (isTestMode) {
      login({ displayName: 'Test User' });
      navigate('/home', { replace: true });
    }
  }, [isTestMode, login, navigate]);

  const handleConnect = async () => {
    try {
      await authorize();
      navigate('/home', { replace: true });
    } catch (err) {
      console.error('Authentication error:', err);
    }
  };

  // Show spinner while session is being restored
  if (isLoading) {
    return (
      <div className="auth-view">
        <div className="auth-content">
          <LoadingSpinner size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-view">
      <div className="auth-content">
        <OwlIcon size={64} />

        <div className="auth-text text-serif">
          <h1 className="text-3xl">Arlo</h1>
          <p className="text-muted">
            Your AI meeting assistant that captures context, generates summaries, and tracks action items in real-time.
          </p>
        </div>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-danger, #ef4444)' }}>
            {error}
          </p>
        )}

        <Button size="lg" onClick={handleConnect} disabled={isAuthorizing} className="auth-btn">
          {isAuthorizing ? 'Connecting...' : 'Connect with Zoom'}
        </Button>
      </div>
    </div>
  );
}
