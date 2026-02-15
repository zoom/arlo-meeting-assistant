import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ZoomSdkProvider, useZoomSdk } from './contexts/ZoomSdkContext';
import { MeetingProvider } from './contexts/MeetingContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/ui/LoadingSpinner';

// Views
import AuthView from './views/AuthView';
import HomeView from './views/HomeView';
import MeetingsListView from './views/MeetingsListView';
import MeetingDetailView from './views/MeetingDetailView';
import InMeetingView from './views/InMeetingView';
import SettingsView from './views/SettingsView';
import GuestNoMeetingView from './views/GuestNoMeetingView';
import GuestInMeetingView from './views/GuestInMeetingView';
import SearchResultsView from './views/SearchResultsView';
import UpcomingMeetingsView from './views/UpcomingMeetingsView';
import LandingPageView from './views/LandingPageView';
import OnboardingView from './views/OnboardingView';
import OAuthErrorView from './views/OAuthErrorView';
import NotFoundView from './views/NotFoundView';
import TestPage from './components/TestPage';

/**
 * Root route handler — decides what to show at "/".
 * - Inside Zoom: redirect to /auth (in-client PKCE flow)
 * - Browser + authenticated: redirect to /home
 * - Browser + unauthenticated: show marketing landing page
 */
function RootView() {
  const { isTestMode: isBrowser } = useZoomSdk();
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isBrowser) {
      navigate('/auth', { replace: true });
      return;
    }
    if (!isLoading && isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isBrowser, isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!isBrowser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return <LandingPageView />;
}

function App() {
  return (
    <ThemeProvider>
      <ZoomSdkProvider>
        <AuthProvider>
          <MeetingProvider>
            <ToastProvider>
              <ErrorBoundary>
                <HashRouter>
                  <Routes>
                    {/* Root: landing page (browser) or redirect to /auth (Zoom) */}
                    <Route path="/" element={<RootView />} />

                    {/* In-client Zoom OAuth (PKCE) */}
                    <Route path="/auth" element={<AuthView />} />

                    {/* Web OAuth flow */}
                    <Route path="/welcome" element={<OnboardingView />} />
                    <Route path="/auth-error" element={<OAuthErrorView />} />

                    {/* Guest routes */}
                    <Route path="/guest" element={<GuestNoMeetingView />} />
                    <Route path="/guest/:id" element={<GuestInMeetingView />} />

                    {/* Authenticated routes (inside AppShell) */}
                    <Route element={
                      <ProtectedRoute>
                        <AppShell />
                      </ProtectedRoute>
                    }>
                      <Route path="/home" element={<HomeView />} />
                      <Route path="/meetings" element={<MeetingsListView />} />
                      <Route path="/meetings/:id" element={<MeetingDetailView />} />
                      <Route path="/meeting/:id" element={<InMeetingView />} />
                      <Route path="/search" element={<SearchResultsView />} />
                      <Route path="/settings" element={<SettingsView />} />
                      <Route path="/upcoming" element={<UpcomingMeetingsView />} />
                    </Route>

                    {/* Dev */}
                    <Route path="/test" element={<TestPage />} />

                    {/* 404 */}
                    <Route path="*" element={<NotFoundView />} />
                  </Routes>
                </HashRouter>
              </ErrorBoundary>
            </ToastProvider>
          </MeetingProvider>
        </AuthProvider>
      </ZoomSdkProvider>
    </ThemeProvider>
  );
}

export default App;
