import React, { createContext, useContext, useState, useEffect } from 'react';

const ZoomSdkContext = createContext();

const zoomSdk = window.zoomSdk;

// Check if running outside Zoom (for testing)
export const isTestMode = !zoomSdk || window.location.search.includes('test=true');

export function ZoomSdkProvider({ children }) {
  const [sdkConfigured, setSdkConfigured] = useState(isTestMode);
  const [sdkError, setSdkError] = useState(null);
  const [runningContext, setRunningContext] = useState(isTestMode ? 'test' : null);
  const [meetingContext, setMeetingContext] = useState(null);
  const [userContext, setUserContext] = useState(null);

  useEffect(() => {
    if (isTestMode) {
      console.log('Running in test mode (outside Zoom)');
      return;
    }

    async function configureSdk() {
      try {
        const configResponse = await zoomSdk.config({
          capabilities: [
            'getMeetingContext',
            'getMeetingUUID',
            'getRunningContext',
            'getUserContext',
            'getMeetingParticipants',
            'authorize',
            'onAuthorized',
            'promptAuthorize',
            'callZoomApi',
            'onMessage',
            'postMessage',
            'showNotification',
          ],
          version: '0.16.0',
        });

        console.log('SDK Configured:', configResponse);
        setSdkConfigured(true);

        // Get running context
        const contextResponse = await zoomSdk.getRunningContext();
        const context = contextResponse.context || contextResponse;
        setRunningContext(context);

        // Get user context
        const user = await zoomSdk.getUserContext();
        setUserContext(user);

        // Get meeting context (if in meeting)
        if (context === 'inMeeting') {
          let meetingData = {};
          let meetingUUID = null;

          try {
            const uuidResponse = await zoomSdk.getMeetingUUID();
            if (uuidResponse) {
              meetingUUID = uuidResponse?.meetingUUID ||
                uuidResponse?.uuid ||
                (typeof uuidResponse === 'string' ? uuidResponse : null);
            }
          } catch (uuidErr) {
            console.error('getMeetingUUID failed:', uuidErr);
          }

          try {
            const meeting = await zoomSdk.getMeetingContext();
            if (!meetingUUID && meeting) {
              meetingUUID = meeting.meetingUUID || meeting.meetingId || meeting.uuid || meeting.id;
            }
            meetingData = { ...meetingData, ...meeting };
            // Capture the numeric meeting ID (e.g. "123-456-789") if available
            if (meeting?.meetingID) {
              meetingData.meetingID = meeting.meetingID;
            }
          } catch {
            // Could not get meeting context
          }

          if (meetingUUID) {
            meetingData.meetingUUID = meetingUUID;
          }

          setMeetingContext(meetingData);
        }
      } catch (error) {
        console.error('SDK Configuration Error:', error);
        setSdkError(error.message);
      }
    }

    configureSdk();
  }, []);

  return (
    <ZoomSdkContext.Provider value={{
      zoomSdk,
      sdkConfigured,
      sdkError,
      runningContext,
      meetingContext,
      userContext,
      isTestMode,
    }}>
      {children}
    </ZoomSdkContext.Provider>
  );
}

export function useZoomSdk() {
  const context = useContext(ZoomSdkContext);
  if (!context) {
    throw new Error('useZoomSdk must be used within a ZoomSdkProvider');
  }
  return context;
}
