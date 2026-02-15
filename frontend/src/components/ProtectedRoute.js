import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useZoomSdk } from '../contexts/ZoomSdkContext';
import LoadingSpinner from './ui/LoadingSpinner';

// Explicit dev mode: only bypass auth when ?test=true is in the URL
const isDevMode = window.location.search.includes('test=true');

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { isTestMode: isBrowser, runningContext } = useZoomSdk();

  // Dev mode: bypass auth for local development with ?test=true
  if (isDevMode) return children;

  // While restoring session, show spinner
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <LoadingSpinner />
      </div>
    );
  }

  // In Zoom mode, also wait for SDK context to be ready
  if (!isBrowser && runningContext === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Browser → landing page, Zoom → in-client auth
    return <Navigate to={isBrowser ? '/' : '/auth'} replace />;
  }

  return children;
}
