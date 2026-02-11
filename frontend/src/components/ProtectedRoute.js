import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useZoomSdk } from '../contexts/ZoomSdkContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const { isTestMode } = useZoomSdk();

  // In test mode, bypass auth
  if (isTestMode) return children;

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}
