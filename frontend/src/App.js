import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ZoomSdkProvider, isTestMode } from './contexts/ZoomSdkContext';
import { MeetingProvider } from './contexts/MeetingContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';

// Views
import AuthView from './views/AuthView';
import HomeView from './views/HomeView';
import MeetingsListView from './views/MeetingsListView';
import MeetingDetailView from './views/MeetingDetailView';
import InMeetingView from './views/InMeetingView';
import SettingsView from './views/SettingsView';
import GuestNoMeetingView from './views/GuestNoMeetingView';
import GuestInMeetingView from './views/GuestInMeetingView';
import NotFoundView from './views/NotFoundView';
import TestPage from './components/TestPage';

function App() {
  // Show test page when running outside Zoom
  if (isTestMode) {
    return (
      <ThemeProvider>
        <ToastProvider>
          <HashRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<HomeView />} />
                <Route path="/home" element={<HomeView />} />
                <Route path="/meetings" element={<MeetingsListView />} />
                <Route path="/meetings/:id" element={<MeetingDetailView />} />
                <Route path="/meeting/:id" element={<InMeetingView />} />
                <Route path="/settings" element={<SettingsView />} />
                <Route path="/test" element={<TestPage />} />
                <Route path="*" element={<NotFoundView />} />
              </Route>
            </Routes>
          </HashRouter>
        </ToastProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ZoomSdkProvider>
        <AuthProvider>
          <MeetingProvider>
            <ToastProvider>
              <ErrorBoundary>
                <HashRouter>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<AuthView />} />
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
                      <Route path="/settings" element={<SettingsView />} />
                    </Route>

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
