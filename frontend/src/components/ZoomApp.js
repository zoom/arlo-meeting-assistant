import React, { useState, useEffect } from 'react';
import './ZoomApp.css';
import LiveTranscript from './LiveTranscript';
import RTMSControls from './RTMSControls';
import AIPanel from './AIPanel';
import MeetingSuggestions from './MeetingSuggestions';
import MeetingHistory from './MeetingHistory';

const zoomSdk = window.zoomSdk;

function ZoomApp({ runningContext, meetingContext, userContext }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [rtmsActive, setRtmsActive] = useState(false);
  const [rtmsLoading, setRtmsLoading] = useState(false);
  const [rtmsStartTime, setRtmsStartTime] = useState(null);
  const [cumulativeTime, setCumulativeTime] = useState(0); // Total elapsed time across sessions
  const [ws, setWs] = useState(null);

  // Meeting start time - using ref so it NEVER resets during re-renders
  const meetingStartTimeRef = React.useRef(null);
  const [, forceUpdate] = useState(0); // Dummy state to trigger re-renders when needed

  // Get current meeting start time
  const getMeetingStartTime = () => meetingStartTimeRef.current;

  // Set meeting start time (only sets once)
  const setMeetingStartTimeOnce = (timestamp) => {
    if (!meetingStartTimeRef.current && timestamp) {
      meetingStartTimeRef.current = timestamp;
      console.log(`⏱️ Meeting timer started at: ${timestamp}`);
      forceUpdate(prev => prev + 1); // Trigger re-render
    }
  };

  // Authenticate user
  useEffect(() => {
    async function authenticate() {
      console.log('🔐 authenticate() called');
      console.log('🔐 userContext:', userContext);
      console.log('🔐 meetingContext:', meetingContext);
      try {
        // Check if user is already authorized
        if (userContext?.status === 'authorized') {
          console.log('✅ User already authorized, skipping OAuth');

          // Create a temporary user object from userContext
          const tempUser = {
            displayName: userContext.screenName,
            participantId: userContext.participantId,
            participantUUID: userContext.participantUUID,
          };

          setUser(tempUser);
          setIsAuthenticated(true);

          // Connect WebSocket without token for anonymous meeting streaming
          console.log('📡 Connecting WebSocket for live transcript streaming...');
          connectWebSocket(null, meetingContext?.meetingUUID);
          return;
        }

        // Get PKCE challenge from backend
        const response = await fetch('/api/auth/authorize');
        const { codeChallenge, state, clientId } = await response.json();

        console.log('🔐 Starting OAuth flow...');

        // Trigger Zoom OAuth
        await zoomSdk.authorize({
          codeChallenge,
          state,
        });

        // Listen for authorization
        zoomSdk.onAuthorized(async (event) => {
          console.log('✅ Authorized:', event);

          const { code, state: returnedState } = event;

          // Exchange code for tokens
          const callbackResponse = await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // CRITICAL: Accept and store httpOnly cookie
            body: JSON.stringify({ code, state: returnedState }),
          });

          const data = await callbackResponse.json();
          console.log('✅ Authentication complete:', data);

          setUser(data.user);
          setIsAuthenticated(true);

          // Connect WebSocket
          connectWebSocket(data.wsToken, meetingContext?.meetingUUID);
        });

      } catch (error) {
        console.error('❌ Authentication error:', error);
      }
    }

    // IMPORTANT: Wait for ALL contexts before authenticating
    // We need meetingContext to have the meetingUUID for WebSocket connection
    if (!isAuthenticated && runningContext === 'inMeeting' && userContext && meetingContext) {
      console.log('🔐 All contexts ready, starting authentication...');
      console.log('🔐 runningContext:', runningContext);
      console.log('🔐 userContext:', userContext);
      console.log('🔐 meetingContext:', meetingContext);
      console.log('🔐 meetingUUID:', meetingContext.meetingUUID);

      // Verify we have a meeting UUID before proceeding
      if (!meetingContext.meetingUUID) {
        console.error('❌ CRITICAL: meetingContext.meetingUUID is missing!');
        console.error('❌ SDK returned meetingContext but no UUID - this should not happen');
        console.error('❌ Full meetingContext:', JSON.stringify(meetingContext));
        // Don't proceed with authentication if we can't get meeting UUID
        return;
      }

      authenticate();
    }
  }, [isAuthenticated, runningContext, userContext, meetingContext]);

  // Auto-start RTMS when authenticated and in meeting (FIRST TIME ONLY)
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const autoStartTimeoutRef = React.useRef(null);

  useEffect(() => {
    // Only auto-start if:
    // 1. We're authenticated
    // 2. In a meeting
    // 3. RTMS is not already active
    // 4. We have a meeting UUID
    // 5. Not currently loading
    // 6. Haven't already auto-started this session
    // 7. User hasn't manually interacted with start/stop buttons
    if (isAuthenticated &&
        runningContext === 'inMeeting' &&
        !rtmsActive &&
        !rtmsLoading &&
        meetingContext?.meetingUUID &&
        !hasAutoStarted &&
        !userHasInteracted) {

      console.log('🚀 Scheduling auto-start of RTMS transcription...');
      setHasAutoStarted(true);

      // Cancel any existing timeout to prevent duplicates
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
      }

      // Delay slightly to ensure everything is ready
      autoStartTimeoutRef.current = setTimeout(() => {
        console.log('🚀 Executing auto-start of RTMS...');
        autoStartTimeoutRef.current = null;
        startRTMS();
      }, 1500);
    }

    // Cleanup function
    return () => {
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
        autoStartTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated, runningContext, rtmsActive, rtmsLoading, meetingContext?.meetingUUID, hasAutoStarted, userHasInteracted]);

  // Connect to WebSocket for live updates
  function connectWebSocket(token, meetingId) {
    console.log('🔍 connectWebSocket called');
    console.log('🔍 meetingId:', meetingId);
    console.log('🔍 meetingId type:', typeof meetingId);
    console.log('🔍 meetingId truthiness:', !!meetingId);
    console.log('🔍 Full meetingContext:', meetingContext);

    // Debug: Send meeting ID to backend for comparison
    fetch('/api/rtms/debug-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingId,
        meetingIdType: typeof meetingId,
        source: 'frontend-websocket',
        fullContext: meetingContext,
      }),
    }).catch(err => console.error('Debug fetch error:', err));

    // Validate meeting ID
    if (!meetingId || meetingId === 'undefined' || meetingId === 'null') {
      console.error('❌ CRITICAL: Cannot connect WebSocket without valid meeting ID');
      console.error('❌ meetingId value:', meetingId);
      console.error('❌ meetingContext:', meetingContext);

      // Show error notification to user
      zoomSdk.showNotification({
        type: 'error',
        title: 'Connection Error',
        message: 'Could not get meeting ID from Zoom. Please check SDK permissions.',
      }).catch(err => console.error('Failed to show notification:', err));

      return;
    }

    // Construct WebSocket URL from current window location
    // Use hostname (not host) to avoid including port numbers
    // ngrok URLs should NOT have a port - they proxy on standard 443
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    let wsUrl = `${protocol}//${hostname}/ws?meeting_id=${encodeURIComponent(meetingId)}`;
    if (token) {
      wsUrl += `&token=${encodeURIComponent(token)}`;
    }
    console.log('📡 Connecting to WebSocket:', wsUrl);
    console.log('📡 Full meeting context:', meetingContext);

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('✅ WebSocket connected');
      socket.send(JSON.stringify({
        type: 'subscribe',
        payload: { meetingId },
      }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('📨 WebSocket message:', message);

      // Handle different message types
      switch (message.type) {
        case 'connected':
          console.log('✅ WebSocket subscribed');
          break;

        case 'transcript.segment':
          // If we receive transcript segments, RTMS is definitely active
          // (This handles the case where startRTMS returns error but RTMS actually started)
          if (!rtmsActive) {
            console.log('✅ Transcripts flowing - setting RTMS as active');
            setRtmsActive(true);
            if (!rtmsStartTime) {
              setRtmsStartTime(Date.now());
            }
            // Set meeting start time ONCE (for continuous timer)
            setMeetingStartTimeOnce(Date.now());
          }
          // Will be handled by LiveTranscript component
          break;

        case 'meeting.status':
          if (message.data.status === 'rtms_started') {
            setRtmsActive(true);
          } else if (message.data.status === 'rtms_stopped') {
            setRtmsActive(false);
          }
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    };

    socket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      console.error('❌ WebSocket readyState:', socket.readyState);
      console.error('❌ WebSocket URL was:', wsUrl);
    };

    socket.onclose = () => {
      console.log('📡 WebSocket disconnected');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => connectWebSocket(token, meetingId), 5000);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }

  // Start RTMS
  async function startRTMS() {
    if (rtmsLoading) return; // Prevent double-clicks

    // Check if another instance is already starting RTMS (prevents React Strict Mode duplicates)
    const startingKey = `rtms-starting-${meetingContext?.meetingUUID}`;
    const alreadyStarting = sessionStorage.getItem(startingKey);
    if (alreadyStarting) {
      const startTime = parseInt(alreadyStarting, 10);
      const elapsed = Date.now() - startTime;
      if (elapsed < 3000) {
        console.warn('⚠️ Another instance is already starting RTMS, skipping...');
        return;
      }
    }

    // Mark that we're starting (expires after 3 seconds)
    sessionStorage.setItem(startingKey, Date.now().toString());

    // Mark that user has interacted (prevents auto-start after manual stop)
    setUserHasInteracted(true);

    setRtmsLoading(true);
    try {
      console.log('🎙️ Starting RTMS...');

      const result = await zoomSdk.callZoomApi('startRTMS', {
        audioOptions: {
          rawAudio: false,
        },
        transcriptOptions: {
          caption: true,
        },
      });

      console.log('✅ RTMS started, result:', result);
      setRtmsActive(true);
      setRtmsStartTime(Date.now());
      console.log('⏱️ RTMS session started, cumulative time so far:', cumulativeTime, 'ms');

      // Set meeting start time ONCE (for continuous timer)
      setMeetingStartTimeOnce(Date.now());

      // Clear the starting flag
      sessionStorage.removeItem(startingKey);

      await zoomSdk.showNotification({
        type: 'success',
        title: 'Arlo',
        message: 'Transcription started',
      });

    } catch (error) {
      console.error('❌ Failed to start RTMS - FULL ERROR:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error code:', error?.code);
      console.error('❌ Error name:', error?.name);
      console.error('❌ Error keys:', error ? Object.keys(error) : 'no keys');
      console.error('❌ Error JSON:', JSON.stringify(error, null, 2));
      console.error('❌ meetingContext at time of error:', meetingContext);
      console.error('❌ meetingUUID:', meetingContext?.meetingUUID);

      // Error code 10308 often means "RTMS is already starting/running"
      // This can happen with React Strict Mode (double mounting) or rapid clicks
      // In many cases, RTMS actually DOES start successfully despite this error
      if (error?.code === '10308') {
        console.warn('⚠️ Error 10308: RTMS may already be starting. Waiting to verify...');

        // Clear the starting flag after a delay
        setTimeout(() => {
          sessionStorage.removeItem(startingKey);
          console.log('⏱️ Checking if RTMS actually started despite error...');
          // If we receive transcript messages, the WebSocket handler will set rtmsActive
        }, 2000);

        // Don't show error to user yet - wait to see if transcripts flow
        setRtmsLoading(false);
        return;
      }

      // For other errors, clear starting flag and show to user
      sessionStorage.removeItem(startingKey);

      let errorMessage = 'Unknown error';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `Error code: ${error.code}`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      await zoomSdk.showNotification({
        type: 'error',
        title: 'Failed to Start Transcription',
        message: errorMessage,
      }).catch(notifErr => console.error('Failed to show notification:', notifErr));
    } finally {
      setRtmsLoading(false);
    }
  }

  // Stop RTMS
  async function stopRTMS() {
    if (rtmsLoading) {
      console.warn('⚠️ stopRTMS called while already loading, ignoring');
      return; // Prevent double-clicks
    }

    // Mark that user has interacted (prevents auto-start after manual stop)
    setUserHasInteracted(true);

    console.log('🛑 Attempting to stop RTMS...');
    console.log('🛑 Current state - rtmsActive:', rtmsActive, 'rtmsLoading:', rtmsLoading);
    setRtmsLoading(true);
    try {
      console.log('🛑 Calling Zoom SDK stopRTMS...');

      const result = await zoomSdk.callZoomApi('stopRTMS');

      console.log('✅ RTMS stopped, result:', result);

      // Calculate elapsed time for this session and add to cumulative
      if (rtmsStartTime) {
        const sessionElapsed = Date.now() - rtmsStartTime;
        const newCumulativeTime = cumulativeTime + sessionElapsed;
        setCumulativeTime(newCumulativeTime);
        console.log('⏱️ Session elapsed:', sessionElapsed, 'ms, new cumulative:', newCumulativeTime, 'ms');
      }

      setRtmsActive(false);
      setRtmsStartTime(null);
      console.log('✅ State updated: rtmsActive=false, rtmsStartTime=null');

      // Show notification (don't await - let it run async)
      zoomSdk.showNotification({
        type: 'info',
        title: 'Arlo',
        message: 'Transcription paused',
      }).catch(notifErr => console.error('Notification error:', notifErr));

    } catch (error) {
      console.error('❌ Failed to stop RTMS - FULL ERROR:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error message:', error?.message);
      console.error('❌ Error code:', error?.code);
      console.error('❌ Error name:', error?.name);
      console.error('❌ Error JSON:', JSON.stringify(error, null, 2));

      // Even if API fails, save cumulative time and reset UI state
      if (rtmsStartTime) {
        const sessionElapsed = Date.now() - rtmsStartTime;
        const newCumulativeTime = cumulativeTime + sessionElapsed;
        setCumulativeTime(newCumulativeTime);
        console.log('⏱️ (Error case) Session elapsed:', sessionElapsed, 'ms, new cumulative:', newCumulativeTime, 'ms');
      }

      setRtmsActive(false);
      setRtmsStartTime(null);
      console.log('✅ State updated (error case): rtmsActive=false, rtmsStartTime=null');

      // Show detailed error to user
      let errorMessage = 'Unknown error';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `Error code: ${error.code}`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Show notification (don't await - let it run async)
      zoomSdk.showNotification({
        type: 'error',
        title: 'Failed to Stop Transcription',
        message: errorMessage,
      }).catch(notifErr => console.error('Failed to show notification:', notifErr));
    } finally {
      console.log('🔄 Finally block: setting rtmsLoading=false');
      setRtmsLoading(false);
      console.log('✅ Finally block complete');
    }
  }

  // Show different UI based on context
  if (runningContext !== 'inMeeting') {
    return (
      <div className="not-in-meeting">
        <h2>📋 Arlo</h2>
        <p>Start or join a meeting to use Arlo Meeting Assistant.</p>
        <div className="features">
          <div className="feature">
            <span className="icon">📝</span>
            <span>Live Transcription</span>
          </div>
          <div className="feature">
            <span className="icon">🤖</span>
            <span>AI-Powered Insights</span>
          </div>
          <div className="feature">
            <span className="icon">🔍</span>
            <span>Searchable Transcripts</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="authenticating">
        <div className="spinner"></div>
        <p>Authenticating...</p>
      </div>
    );
  }

  return (
    <div className="zoom-app">
      <div className="header">
        <h1>📋 Arlo</h1>
        <div className="user-info">
          <span>{user?.displayName}</span>
        </div>
      </div>

      <div className="zoom-app-content">
        <RTMSControls
          rtmsActive={rtmsActive}
          rtmsLoading={rtmsLoading}
          onStart={startRTMS}
          onStop={stopRTMS}
        />

        <MeetingSuggestions
          rtmsActive={rtmsActive}
          meetingStartTime={getMeetingStartTime()}
          meetingId={meetingContext?.meetingUUID}
          scheduledDuration={meetingContext?.scheduledDuration}
        />

        <LiveTranscript
          ws={ws}
          rtmsActive={rtmsActive}
          meetingId={meetingContext?.meetingUUID}
        />

        <AIPanel meetingId={meetingContext?.meetingUUID} />

        <MeetingHistory />
      </div>
    </div>
  );
}

export default ZoomApp;
