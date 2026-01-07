import React, { useState, useEffect } from 'react';
import './App.css';
import ZoomApp from './components/ZoomApp';
import TestPage from './components/TestPage';

const zoomSdk = window.zoomSdk;

// Check if running outside Zoom (for testing)
const isTestMode = !zoomSdk || window.location.search.includes('test=true');

function App() {
  const [sdkConfigured, setSdkConfigured] = useState(isTestMode);
  const [sdkError, setError] = useState(null);
  const [runningContext, setRunningContext] = useState(null);
  const [meetingContext, setMeetingContext] = useState(null);
  const [userContext, setUserContext] = useState(null);

  useEffect(() => {
    // If in test mode, skip SDK configuration
    if (isTestMode) {
      console.log('🧪 Running in test mode (outside Zoom)');
      return;
    }

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
          let meetingData = {};
          let meetingUUID = null;

          // Try multiple methods to get meeting UUID
          // Method 1: getMeetingUUID() - primary method
          try {
            const uuidResponse = await zoomSdk.getMeetingUUID();
            console.log('🎥 getMeetingUUID raw response:', uuidResponse);
            console.log('🎥 getMeetingUUID typeof:', typeof uuidResponse);

            if (uuidResponse) {
              console.log('🎥 getMeetingUUID keys:', Object.keys(uuidResponse));

              // Try different response formats
              meetingUUID = uuidResponse?.meetingUUID || // { meetingUUID: "xxx" }
                           uuidResponse?.uuid ||         // { uuid: "xxx" }
                           (typeof uuidResponse === 'string' ? uuidResponse : null); // "xxx"
            }

            console.log('🎥 Extracted meetingUUID from getMeetingUUID:', meetingUUID);
          } catch (uuidErr) {
            console.error('⚠️ getMeetingUUID failed:', uuidErr);
            console.error('⚠️ Error details:', uuidErr?.message, uuidErr?.code);
          }

          // Method 2: getMeetingContext() - fallback method
          try {
            const meeting = await zoomSdk.getMeetingContext();
            console.log('🎥 Meeting Context:', meeting);

            // Try to extract UUID from meeting context if we don't have it yet
            if (!meetingUUID && meeting) {
              meetingUUID = meeting.meetingUUID ||
                           meeting.meetingId ||
                           meeting.uuid ||
                           meeting.id;
              console.log('🎥 Extracted meetingUUID from getMeetingContext:', meetingUUID);
            }

            meetingData = { ...meetingData, ...meeting };
          } catch (err) {
            console.warn('⚠️ Could not get meeting context:', err);
          }

          // Set the extracted UUID
          if (meetingUUID) {
            meetingData.meetingUUID = meetingUUID;
            console.log('✅ Final meetingUUID:', meetingUUID);
          } else {
            console.error('❌ CRITICAL: Could not extract meeting UUID from any SDK method!');
            console.error('❌ Available data:', meetingData);
          }

          console.log('🎥 Final meeting data:', meetingData);
          setMeetingContext(meetingData);
        }

      } catch (error) {
        console.error('❌ SDK Configuration Error:', error);
        setError(error.message);
      }
    }

    configureSdk();
  }, []);

  // Show test page when running outside Zoom (or when SDK fails)
  if (isTestMode || sdkError) {
    return (
      <div className="App">
        <TestPage />
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
