import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useZoomSdk } from '../contexts/ZoomSdkContext';

/**
 * Shared hook for Zoom in-client OAuth using PKCE.
 * Registers onAuthorized listener inside authorize() — after SDK is configured
 * but before calling zoomSdk.authorize() — to avoid race conditions.
 *
 * Note: The Zoom SDK's onAuthorized event returns { code, result, redirectUri, timestamp }
 * but does NOT return the state. We use the state from our own PKCE request instead.
 */
export default function useZoomAuth() {
  const { login } = useAuth();
  const { zoomSdk } = useZoomSdk();
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [error, setError] = useState(null);

  // Track active listener for cleanup on unmount
  const cleanupRef = useRef(null);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const authorize = useCallback(async () => {
    if (!zoomSdk) throw new Error('Zoom SDK not available');

    setIsAuthorizing(true);
    setError(null);

    try {
      // 1. Get PKCE challenge from backend
      const response = await fetch('/api/auth/authorize');
      if (!response.ok) throw new Error('Failed to get auth challenge');
      const { codeChallenge, state } = await response.json();

      // 2. Register listener BEFORE calling authorize (SDK is configured by now)
      const authPromise = new Promise((resolve, reject) => {
        const handler = async (event) => {
          // Self-clean immediately
          zoomSdk.removeEventListener('onAuthorized', handler);
          cleanupRef.current = null;

          const { code } = event;
          if (!code) {
            reject(new Error('No authorization code received'));
            return;
          }

          try {
            // Use state from our PKCE request — the SDK does not return it in the event
            const callbackResponse = await fetch('/api/auth/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ code, state }),
            });

            if (!callbackResponse.ok) {
              const data = await callbackResponse.json().catch(() => ({}));
              throw new Error(data.error || `Auth callback failed (${callbackResponse.status})`);
            }

            const data = await callbackResponse.json();
            login(data.user, data.wsToken);
            resolve(data);
          } catch (err) {
            reject(err);
          }
        };

        cleanupRef.current = () => zoomSdk.removeEventListener('onAuthorized', handler);
        zoomSdk.addEventListener('onAuthorized', handler);
      });

      // 3. Trigger Zoom OAuth (listener is already registered)
      await zoomSdk.authorize({ codeChallenge, state });

      // 4. Wait for the onAuthorized handler to complete the exchange
      return await authPromise;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsAuthorizing(false);
    }
  }, [zoomSdk, login]);

  return { authorize, isAuthorizing, error };
}
