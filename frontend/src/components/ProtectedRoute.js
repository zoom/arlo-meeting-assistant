import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useZoomSdk } from '../contexts/ZoomSdkContext';
import LoadingSpinner from './ui/LoadingSpinner';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { isTestMode } = useZoomSdk();

  // In test mode, bypass auth
  if (isTestMode) return children;

  // While restoring session, show spinner instead of redirecting
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}
