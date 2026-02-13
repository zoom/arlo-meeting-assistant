import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useZoomSdk } from './ZoomSdkContext';

const MeetingContext = createContext();

export function MeetingProvider({ children }) {
  const { zoomSdk, meetingContext } = useZoomSdk();
  const [rtmsActive, setRtmsActive] = useState(false);
  const [rtmsLoading, setRtmsLoading] = useState(false);
  const [ws, setWs] = useState(null);

  const meetingStartTimeRef = useRef(null);
  const autoStartAttemptedRef = useRef(false);
  const titleSentRef = useRef(false);

  const meetingId = meetingContext?.meetingUUID;

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
      setTimeout(() => {
        const reconnected = connectWebSocket(token, meetingId);
        if (reconnected) setWs(reconnected);
      }, 5000);
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
  }, [rtmsLoading, zoomSdk, meetingId]);

  const stopRTMS = useCallback(async () => {
    if (rtmsLoading || !zoomSdk) return;

    setRtmsLoading(true);
    try {
      await zoomSdk.callZoomApi('stopRTMS');
      setRtmsActive(false);

      zoomSdk.showNotification({
        type: 'info',
        title: 'Arlo',
        message: 'Transcription paused',
      }).catch(() => {});
    } catch {
      setRtmsActive(false);
    } finally {
      setRtmsLoading(false);
    }
  }, [rtmsLoading, zoomSdk]);

  // Send Zoom meeting topic to backend to replace generic "Meeting M/D/YYYY" title
  // Wait for rtmsActive so the meeting record exists in the DB before patching
  useEffect(() => {
    const topic = meetingContext?.meetingTopic;
    if (!rtmsActive || !meetingId || !topic || titleSentRef.current) return;
    titleSentRef.current = true;

    let attempts = 0;
    const sendTitle = () => {
      fetch(`/api/meetings/by-zoom-id/${encodeURIComponent(meetingId)}/topic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: topic }),
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
      rtmsLoading,
      ws,
      meetingId,
      meetingStartTime: meetingStartTimeRef.current,
      autoStartAttemptedRef,
      startRTMS,
      stopRTMS,
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
