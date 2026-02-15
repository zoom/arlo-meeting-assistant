import React, { useEffect, useCallback } from 'react';
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
  const { runningContext, meetingContext } = useZoomSdk();
  const { authorize, isAuthorizing, error } = useZoomAuth();

  const getPostAuthDestination = useCallback(() => {
    if (runningContext === 'inMeeting' && meetingContext?.meetingUUID) {
      return `/meeting/${encodeURIComponent(meetingContext.meetingUUID)}`;
    }
    return '/home';
  }, [runningContext, meetingContext]);

  // Redirect if already authenticated and SDK context is ready
  useEffect(() => {
    if (!isAuthenticated) return;
    if (runningContext === null) return; // SDK still loading
    navigate(getPostAuthDestination(), { replace: true });
  }, [isAuthenticated, runningContext, navigate, getPostAuthDestination]);

  // In explicit dev mode (?test=true), allow auth bypass
  useEffect(() => {
    if (window.location.search.includes('test=true')) {
      login({ displayName: 'Test User' });
      navigate('/home', { replace: true });
    }
  }, [login, navigate]);

  const handleConnect = async () => {
    try {
      await authorize();
      // Navigation handled by the useEffect above after login sets isAuthenticated
    } catch (err) {
      console.error('Authentication error:', err);
    }
  };

  // Show spinner while session is being restored or authenticated but waiting for SDK
  if (isLoading || (isAuthenticated && runningContext === null)) {
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
