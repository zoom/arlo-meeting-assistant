import React, { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@base-ui/react';
import './LiveTranscript.css';

function LiveTranscript({ ws, rtmsActive, meetingId }) {
  const [segments, setSegments] = useState([]);
  const [followLive, setFollowLive] = useState(true);
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'transcript.segment') {
        const { segment } = message.data;
        setSegments((prev) => [...prev, segment]);

        // Auto-scroll if following live
        if (followLive && transcriptRef.current) {
          transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
        }
      }
    };

    ws.addEventListener('message', handleMessage);

    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws, followLive]);

  // Detect manual scroll
  const handleScroll = () => {
    if (!transcriptRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = transcriptRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    setFollowLive(isAtBottom);
  };

  if (!rtmsActive) {
    return (
      <div className="transcript-empty">
        <p>Start Arlo to see live transcription</p>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="transcript-empty">
        <div className="spinner"></div>
        <p>Waiting for transcript...</p>
      </div>
    );
  }

  return (
    <div className="live-transcript">
      <div className="transcript-header">
        <span className="transcript-count">{segments.length} lines</span>
        {!followLive && (
          <button
            className="resume-live"
            onClick={() => {
              setFollowLive(true);
              if (transcriptRef.current) {
                transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
              }
            }}
          >
            ⬇️ Resume Live
          </button>
        )}
      </div>

      <ScrollArea.Root className="transcript-scroll-area">
        <ScrollArea.Viewport
          ref={transcriptRef}
          className="transcript-container"
          onScroll={handleScroll}
        >
          {segments.map((segment, index) => (
            <div key={index} className="transcript-segment">
              <div className="segment-meta">
                <span className="speaker">{segment.speakerLabel}</span>
                <span className="timestamp">
                  {formatTimestamp(segment.tStartMs)}
                </span>
              </div>
              <div className="segment-text">{segment.text}</div>
            </div>
          ))}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="transcript-scrollbar">
          <ScrollArea.Thumb className="transcript-scrollbar-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}

function formatTimestamp(ms) {
  const date = new Date(ms);
  if (isNaN(date.getTime()) || ms === 0) return '--:--';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default LiveTranscript;
