import React, { useState, useEffect } from 'react';
import './App.css';
import ZoomApp from './components/ZoomApp';

const zoomSdk = window.zoomSdk;

function App() {
  const [sdkConfigured, setSdkConfigured] = useState(false);
  const [sdkError, setError] = useState(null);
  const [runningContext, setRunningContext] = useState(null);
  const [meetingContext, setMeetingContext] = useState(null);
  const [userContext, setUserContext] = useState(null);

  useEffect(() => {
    async function configureSdk() {
      try {
        console.log('🚀 Initializing Zoom Apps SDK...');

        // Configure SDK with required capabilities
        const configResponse = await zoomSdk.config({
          capabilities: [
            // Context APIs
            'getMeetingContext',
            'getMeetingUUID',
            'getRunningContext',
            'getUserContext',
            'getMeetingParticipants',

            // Auth APIs
            'authorize',
            'onAuthorized',
            'promptAuthorize',

            // RTMS APIs
            'callZoomApi', // For startRTMS/stopRTMS

            // Communication
            'onMessage',
            'postMessage',

            // UI APIs
            'showNotification',
          ],
          version: '0.16.0',
        });

        console.log('✅ SDK Configured:', configResponse);
        setSdkConfigured(true);

        // Get running context
        const contextResponse = await zoomSdk.getRunningContext();
        console.log('📍 Running Context:', contextResponse);
        const context = contextResponse.context || contextResponse; // Handle both object and string response
        setRunningContext(context);

        // Get user context
        const user = await zoomSdk.getUserContext();
        console.log('👤 User Context:', user);
        setUserContext(user);

        // Get meeting context (if in meeting)
        if (context === 'inMeeting') {
          try {
            const meeting = await zoomSdk.getMeetingContext();
            console.log('🎥 Meeting Context:', meeting);
            setMeetingContext(meeting);
          } catch (err) {
            console.warn('⚠️ Could not get meeting context:', err);
          }
        }

      } catch (error) {
        console.error('❌ SDK Configuration Error:', error);
        setError(error.message);
      }
    }

    configureSdk();
  }, []);

  if (sdkError) {
    return (
      <div className="error-container">
        <h1>❌ SDK Error</h1>
        <p>{sdkError}</p>
        <p>Please check the console for more details.</p>
      </div>
    );
  }

  if (!sdkConfigured) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Initializing Zoom Apps SDK...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <ZoomApp
        runningContext={runningContext}
        meetingContext={meetingContext}
        userContext={userContext}
      />
    </div>
  );
}

export default App;
