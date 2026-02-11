import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useZoomSdk } from '../contexts/ZoomSdkContext';
import OwlIcon from '../components/OwlIcon';
import Button from '../components/ui/Button';
import './AuthView.css';

export default function AuthView() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const { zoomSdk, userContext, isTestMode } = useZoomSdk();

  // Redirect if already authenticated
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
      // Check if user is already authorized via Zoom SDK
      if (userContext?.status === 'authorized') {
        login({
          displayName: userContext.screenName,
          participantId: userContext.participantId,
        });
        navigate('/home', { replace: true });
        return;
      }

      // Get PKCE challenge from backend
      const response = await fetch('/api/auth/authorize');
      const { codeChallenge, state } = await response.json();

      // Trigger Zoom OAuth
      await zoomSdk.authorize({ codeChallenge, state });

      // Listen for authorization
      zoomSdk.onAuthorized(async (event) => {
        const { code, state: returnedState } = event;

        const callbackResponse = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, state: returnedState }),
        });

        const data = await callbackResponse.json();
        login(data.user);
        navigate('/home', { replace: true });
      });
    } catch (error) {
      console.error('Authentication error:', error);
    }
  };

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

        <Button size="lg" onClick={handleConnect} className="auth-btn">
          Connect with Zoom
        </Button>
      </div>
    </div>
  );
}
