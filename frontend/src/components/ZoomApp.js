import React, { useState, useEffect } from 'react';
import './ZoomApp.css';
import LiveTranscript from './LiveTranscript';
import RTMSControls from './RTMSControls';

const zoomSdk = window.zoomSdk;

function ZoomApp({ runningContext, meetingContext, userContext }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [rtmsActive, setRtmsActive] = useState(false);
  const [ws, setWs] = useState(null);

  // Authenticate user
  useEffect(() => {
    async function authenticate() {
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

          console.log('⚠️ Note: Using temp user without backend session.');
          console.log('⚠️ WebSocket connection skipped (no token). RTMS controls will work, but live transcript display requires full OAuth.');
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

    if (!isAuthenticated && runningContext === 'inMeeting' && userContext) {
      authenticate();
    }
  }, [isAuthenticated, runningContext, meetingContext, userContext]);

  // Connect to WebSocket for live updates
  function connectWebSocket(token, meetingId) {
    if (!meetingId) return;

    // Construct WebSocket URL from current window location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}?meeting_id=${meetingId}&token=${token}`;
    console.log('📡 Connecting to WebSocket:', wsUrl);

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
    try {
      console.log('🎙️ Starting RTMS...');

      await zoomSdk.callZoomApi('startRTMS', {
        audioOptions: {
          rawAudio: false,
        },
        transcriptOptions: {
          caption: true,
        },
      });

      console.log('✅ RTMS started');
      setRtmsActive(true);

      await zoomSdk.showNotification({
        type: 'success',
        title: 'Meeting Assistant',
        message: 'Transcription started',
      });

    } catch (error) {
      console.error('❌ Failed to start RTMS:', error);

      await zoomSdk.showNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to start transcription',
      });
    }
  }

  // Stop RTMS
  async function stopRTMS() {
    try {
      console.log('🛑 Stopping RTMS...');

      await zoomSdk.callZoomApi('stopRTMS');

      console.log('✅ RTMS stopped');
      setRtmsActive(false);

      await zoomSdk.showNotification({
        type: 'info',
        title: 'Meeting Assistant',
        message: 'Transcription stopped',
      });

    } catch (error) {
      console.error('❌ Failed to stop RTMS:', error);
    }
  }

  // Show different UI based on context
  if (runningContext !== 'inMeeting') {
    return (
      <div className="not-in-meeting">
        <h2>📋 Meeting Assistant</h2>
        <p>Start or join a meeting to use the Meeting Assistant.</p>
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
        <h1>📋 Meeting Assistant</h1>
        <div className="user-info">
          <span>{user?.displayName}</span>
        </div>
      </div>

      <RTMSControls
        rtmsActive={rtmsActive}
        onStart={startRTMS}
        onStop={stopRTMS}
      />

      <LiveTranscript
        ws={ws}
        rtmsActive={rtmsActive}
        meetingId={meetingContext?.meetingUUID}
      />
    </div>
  );
}

export default ZoomApp;
