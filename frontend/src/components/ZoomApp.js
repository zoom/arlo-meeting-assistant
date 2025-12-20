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
  const [ws, setWs] = useState(null);

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

    // Only authenticate when we have ALL the contexts we need
    if (!isAuthenticated && runningContext === 'inMeeting' && userContext && meetingContext) {
      console.log('🔐 All contexts available, starting authentication...');
      console.log('🔐 meetingContext keys:', Object.keys(meetingContext || {}));
      authenticate();
    }
  }, [isAuthenticated, runningContext, meetingContext, userContext]);

  // Connect to WebSocket for live updates
  function connectWebSocket(token, meetingId) {
    console.log('🔍 connectWebSocket called with meetingId:', meetingId);

    // Debug: Send meeting ID to backend for comparison
    fetch('/api/rtms/debug-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingId,
        source: 'frontend-websocket',
        fullContext: meetingContext,
      }),
    }).catch(err => console.error('Debug fetch error:', err));

    if (!meetingId) {
      console.log('⚠️ No meeting ID, skipping WebSocket connection');
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

      await zoomSdk.showNotification({
        type: 'success',
        title: 'Arlo',
        message: 'Transcription started',
      });

    } catch (error) {
      console.error('❌ Failed to start RTMS:', error);
      console.error('❌ Error details:', error?.message, error?.code);

      await zoomSdk.showNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to start transcription: ${error?.message || 'Unknown error'}`,
      });
    } finally {
      setRtmsLoading(false);
    }
  }

  // Stop RTMS
  async function stopRTMS() {
    if (rtmsLoading) return; // Prevent double-clicks

    setRtmsLoading(true);
    try {
      console.log('🛑 Stopping RTMS...');

      const result = await zoomSdk.callZoomApi('stopRTMS');

      console.log('✅ RTMS stopped, result:', result);
      setRtmsActive(false);
      setRtmsStartTime(null);

      await zoomSdk.showNotification({
        type: 'info',
        title: 'Arlo',
        message: 'Transcription stopped',
      });

    } catch (error) {
      console.error('❌ Failed to stop RTMS:', error);
      console.error('❌ Error details:', error?.message, error?.code);

      // Even if API fails, try to reset the UI state
      setRtmsActive(false);

      await zoomSdk.showNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to stop transcription: ${error?.message || 'Unknown error'}`,
      });
    } finally {
      setRtmsLoading(false);
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

      <RTMSControls
        rtmsActive={rtmsActive}
        rtmsLoading={rtmsLoading}
        onStart={startRTMS}
        onStop={stopRTMS}
      />

      <MeetingSuggestions
        rtmsActive={rtmsActive}
        rtmsStartTime={rtmsStartTime}
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
  );
}

export default ZoomApp;
