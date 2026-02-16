import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useZoomSdk } from './ZoomSdkContext';
import { useAuth } from './AuthContext';

const MeetingContext = createContext();

const DEFAULT_CHAT_NOTICES = {
  enabled: true,
  events: { start: true, pause: true, resume: true, stop: false, restart: false },
  messages: {
    start: "I'm using a Zoom app, Arlo, to transcribe this meeting and generate a summary.",
    pause: 'Transcription paused.',
    resume: 'Transcription resumed.',
    stop: 'Transcription stopped. Transcript will be available shortly.',
    restart: 'Transcription restarted.',
  },
};

export function MeetingProvider({ children }) {
  const { zoomSdk, meetingContext } = useZoomSdk();
  const [rtmsActive, setRtmsActive] = useState(false);
  const [rtmsPaused, setRtmsPaused] = useState(false);
  const [rtmsLoading, setRtmsLoading] = useState(false);
  const [ws, setWs] = useState(null);

  const meetingStartTimeRef = useRef(null);
  const autoStartAttemptedRef = useRef(false);
  const titleSentRef = useRef(false);
  const hasBeenActiveRef = useRef(false);
  const shouldReconnectRef = useRef(true);

  const meetingId = meetingContext?.meetingUUID;

  // Clean up when meeting ends (meetingId becomes falsy) and prepare for new meetings
  useEffect(() => {
    if (meetingId) {
      // New meeting — allow WS reconnects and reset per-meeting refs
      shouldReconnectRef.current = true;
      autoStartAttemptedRef.current = false;
      titleSentRef.current = false;
      hasBeenActiveRef.current = false;
      meetingStartTimeRef.current = null;
    } else {
      // Meeting ended — stop reconnecting, close WS, reset state
      shouldReconnectRef.current = false;
      setRtmsActive(false);
      setRtmsPaused(false);
      setWs(prev => {
        if (prev && prev.readyState !== WebSocket.CLOSED) {
          prev.close();
        }
        return null;
      });
    }
  }, [meetingId]);

  // Send a chat notice to Zoom meeting chat for a given event type
  const sendChatNotice = useCallback((eventType) => {
    if (!zoomSdk) return;
    try {
      const raw = localStorage.getItem('arlo-chat-notices');
      const prefs = raw ? JSON.parse(raw) : DEFAULT_CHAT_NOTICES;
      if (!prefs.enabled) return;
      if (!prefs.events?.[eventType]) return;
      const template = prefs.messages?.[eventType] || DEFAULT_CHAT_NOTICES.messages[eventType];
      if (!template) return;
      const message = meetingId
        ? template.replace(/\[meeting-id\]/g, meetingId)
        : template;
      zoomSdk.sendMessageToChat({ message }).catch(() => {});
    } catch {
      // Silently ignore — chat notices are best-effort
    }
  }, [zoomSdk, meetingId]);

  const connectWebSocket = useCallback((token, meetingId) => {
    if (!meetingId || meetingId === 'undefined' || meetingId === 'null') {
      console.error('Cannot connect WebSocket without valid meeting ID');
      return null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    let wsUrl = `${protocol}//${hostname}/ws?meeting_id=${encodeURIComponent(meetingId)}`;
    if (token) {
      wsUrl += `&token=${encodeURIComponent(token)}`;
    }

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected');
      socket.send(JSON.stringify({
        type: 'subscribe',
        payload: { meetingId },
      }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'transcript.segment':
          if (!rtmsActive) {
            setRtmsActive(true);
            if (!meetingStartTimeRef.current) {
              meetingStartTimeRef.current = Date.now();
            }
          }
          break;
        case 'meeting.status':
          if (message.data.status === 'rtms_started') {
            setRtmsActive(true);
          } else if (message.data.status === 'rtms_stopped') {
            setRtmsActive(false);
            setRtmsPaused(false);
          }
          break;
        default:
          break;
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      if (shouldReconnectRef.current) {
        setTimeout(() => {
          if (shouldReconnectRef.current) {
            const reconnected = connectWebSocket(token, meetingId);
            if (reconnected) setWs(reconnected);
          }
        }, 5000);
      }
    };

    setWs(socket);
    return socket;
  }, [rtmsActive]);

  const startRTMS = useCallback(async (isAutoStart = false) => {
    if (rtmsLoading || !zoomSdk) return;

    const startingKey = `rtms-starting-${meetingId}`;
    const alreadyStarting = sessionStorage.getItem(startingKey);
    if (alreadyStarting) {
      const elapsed = Date.now() - parseInt(alreadyStarting, 10);
      if (elapsed < 3000) return;
    }

    sessionStorage.setItem(startingKey, Date.now().toString());
    setRtmsLoading(true);

    try {
      await zoomSdk.callZoomApi('startRTMS', {
        audioOptions: { rawAudio: false },
        transcriptOptions: { caption: true },
      });

      setRtmsActive(true);
      if (!meetingStartTimeRef.current) {
        meetingStartTimeRef.current = Date.now();
      }
      sessionStorage.removeItem(startingKey);

      // Send chat notice: restart if previously active, otherwise start
      if (hasBeenActiveRef.current) {
        sendChatNotice('restart');
      } else {
        sendChatNotice('start');
        hasBeenActiveRef.current = true;
      }

      zoomSdk.showNotification({
        type: 'success',
        title: 'Arlo',
        message: 'Transcription started',
      }).catch(() => {});
    } catch (error) {
      if (error?.code === '10308') {
        setTimeout(() => sessionStorage.removeItem(startingKey), 2000);
        setRtmsLoading(false);
        return;
      }
      sessionStorage.removeItem(startingKey);
    } finally {
      setRtmsLoading(false);
    }
  }, [rtmsLoading, zoomSdk, meetingId, sendChatNotice]);

  const stopRTMS = useCallback(async () => {
    if (rtmsLoading || !zoomSdk) return;

    setRtmsLoading(true);
    try {
      await zoomSdk.callZoomApi('stopRTMS');
      setRtmsActive(false);
      setRtmsPaused(false);

      sendChatNotice('stop');

      zoomSdk.showNotification({
        type: 'info',
        title: 'Arlo',
        message: 'Transcription paused',
      }).catch(() => {});
    } catch {
      setRtmsActive(false);
      setRtmsPaused(false);
    } finally {
      setRtmsLoading(false);
    }
  }, [rtmsLoading, zoomSdk, sendChatNotice]);

  const pauseRTMS = useCallback(async () => {
    if (rtmsLoading || !zoomSdk) return;
    setRtmsLoading(true);
    try {
      await zoomSdk.callZoomApi('pauseRTMS');
      setRtmsPaused(true);
      sendChatNotice('pause');
      // Notify backend for timeline event
      fetch('/api/rtms/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ meetingId, status: 'rtms_paused' }),
      }).catch(() => {});
    } catch (error) {
      console.error('pauseRTMS failed:', error);
    } finally {
      setRtmsLoading(false);
    }
  }, [rtmsLoading, zoomSdk, sendChatNotice, meetingId]);

  const resumeRTMS = useCallback(async () => {
    if (rtmsLoading || !zoomSdk) return;
    setRtmsLoading(true);
    try {
      await zoomSdk.callZoomApi('resumeRTMS');
      setRtmsPaused(false);
      sendChatNotice('resume');
      // Notify backend for timeline event
      fetch('/api/rtms/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ meetingId, status: 'rtms_resumed' }),
      }).catch(() => {});
    } catch (error) {
      console.error('resumeRTMS failed:', error);
    } finally {
      setRtmsLoading(false);
    }
  }, [rtmsLoading, zoomSdk, sendChatNotice, meetingId]);

  // Stable ref to startRTMS so the auto-start timer isn't cancelled
  // when the callback reference changes (sendChatNotice/meetingId stabilising)
  const startRTMSRef = useRef(startRTMS);
  useEffect(() => { startRTMSRef.current = startRTMS; }, [startRTMS]);

  // Auto-start RTMS when authenticated and in a meeting (conditional on user preference)
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (autoStartAttemptedRef.current || !isAuthenticated || !meetingId || rtmsActive || rtmsLoading) return;
    if (localStorage.getItem('arlo-auto-start') === 'false') return;
    autoStartAttemptedRef.current = true;
    const timer = setTimeout(() => startRTMSRef.current(true), 1500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, meetingId, rtmsActive, rtmsLoading]);

  // Send Zoom meeting topic to backend to replace generic "Meeting M/D/YYYY" title
  // Wait for rtmsActive so the meeting record exists in the DB before patching
  useEffect(() => {
    const topic = meetingContext?.meetingTopic;
    const meetingNumber = meetingContext?.meetingID;
    if (!rtmsActive || !meetingId || !topic || titleSentRef.current) return;
    titleSentRef.current = true;

    let attempts = 0;
    const sendTitle = () => {
      fetch(`/api/meetings/by-zoom-id/${encodeURIComponent(meetingId)}/topic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: topic, meetingNumber }),
      }).then(res => {
        // Meeting record may not exist yet — retry after delay (max 3 attempts)
        if (res.status === 404 && ++attempts < 3) {
          setTimeout(sendTitle, 3000);
        }
      }).catch(() => {});
    };
    sendTitle();
  }, [rtmsActive, meetingId, meetingContext?.meetingTopic]);

  return (
    <MeetingContext.Provider value={{
      rtmsActive,
      rtmsPaused,
      rtmsLoading,
      ws,
      meetingId,
      meetingStartTime: meetingStartTimeRef.current,
      autoStartAttemptedRef,
      startRTMS,
      stopRTMS,
      pauseRTMS,
      resumeRTMS,
      connectWebSocket,
      setWs,
    }}>
      {children}
    </MeetingContext.Provider>
  );
}

export function useMeeting() {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error('useMeeting must be used within a MeetingProvider');
  }
  return context;
}
