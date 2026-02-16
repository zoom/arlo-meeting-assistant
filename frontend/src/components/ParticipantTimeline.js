import React, { useState, useRef, useCallback } from 'react';
import { ScrollArea } from '@base-ui/react';
import { LogIn, LogOut, Users, ArrowDown, Mic, MicOff, Pause, Play } from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import './ParticipantTimeline.css';

function formatTimestamp(ms) {
  const date = new Date(Number(ms));
  if (isNaN(date.getTime()) || ms === 0) return '--:--';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Build the "Meeting started with..." message from initial roster events.
 * Prefers `initial_roster` events (new RTMS classification).
 * Falls back to legacy 60s-grouping of `joined` events for old meeting data.
 */
function buildInitialParticipants(events) {
  if (!events || events.length === 0) return null;

  // Prefer initial_roster events (reliable, set by RTMS before first transcript)
  let initial = events.filter(e => e.eventType === 'initial_roster');

  // Legacy fallback: group joined events within first 60s for old meetings
  if (initial.length === 0) {
    const joinEvents = events.filter(e => e.eventType === 'joined');
    if (joinEvents.length === 0) return null;

    const firstTimestamp = joinEvents[0].timestamp;
    const threshold = 60000;
    initial = joinEvents.filter(e => e.timestamp - firstTimestamp <= threshold);
  }

  if (initial.length === 0) return null;

  const names = initial.map(e => e.participantName);
  let text;
  if (names.length <= 3) {
    text = `Meeting started with ${names.join(', ')}`;
  } else {
    text = `Meeting started with ${names[0]}, ${names[1]}, and ${names.length - 2} others`;
  }

  return {
    type: 'meeting-started',
    text,
    timestamp: initial[0].timestamp,
    participantIds: initial.map(e => e.participantId),
  };
}

/**
 * Merge transcript segments and participant events into a single chronological timeline.
 */
function buildTimeline(segments, events) {
  const items = [];

  // Build initial participants message
  const initialMsg = buildInitialParticipants(events);
  const initialParticipantIds = new Set(initialMsg?.participantIds || []);
  const firstTimestamp = events?.length > 0
    ? events.filter(e => e.eventType === 'joined')[0]?.timestamp || 0
    : 0;
  const threshold = 60000;

  if (initialMsg) {
    items.push(initialMsg);
  }

  // Add transcript segments
  segments.forEach(seg => {
    items.push({
      type: 'transcript',
      timestamp: Number(seg.tStartMs),
      speaker: seg.speaker?.displayName || seg.speaker?.label || seg.speakerLabel || 'Speaker',
      text: seg.text,
      id: seg.id || seg.seqNo,
    });
  });

  // Add participant events (skip initial_roster and legacy-grouped initial joins)
  (events || []).forEach(evt => {
    // Skip initial_roster events — they're represented by the "Meeting started with..." message
    if (evt.eventType === 'initial_roster') return;

    // Legacy: skip joined events that are part of the initial group (old data without initial_roster)
    if (
      evt.eventType === 'joined' &&
      initialParticipantIds.has(evt.participantId) &&
      evt.timestamp - firstTimestamp <= threshold
    ) {
      return;
    }

    items.push({
      type: 'participant-event',
      eventType: evt.eventType,
      participantName: evt.participantName,
      timestamp: Number(evt.timestamp),
      id: evt.id,
    });
  });

  // Sort by timestamp
  items.sort((a, b) => a.timestamp - b.timestamp);

  return items;
}

function EventIcon({ eventType }) {
  switch (eventType) {
    case 'joined': return <LogIn size={14} className="timeline-event-icon" />;
    case 'left': return <LogOut size={14} className="timeline-event-icon" />;
    case 'transcription_started': return <Mic size={14} className="timeline-event-icon" />;
    case 'transcription_stopped': return <MicOff size={14} className="timeline-event-icon" />;
    case 'transcription_paused': return <Pause size={14} className="timeline-event-icon" />;
    case 'transcription_resumed': return <Play size={14} className="timeline-event-icon" />;
    default: return <Users size={14} className="timeline-event-icon" />;
  }
}

function EventLabel({ eventType, name }) {
  switch (eventType) {
    case 'joined': return `${name} joined the meeting`;
    case 'left': return `${name} left the meeting`;
    case 'transcription_started': return 'Transcription started';
    case 'transcription_stopped': return 'Transcription stopped';
    case 'transcription_paused': return 'Transcription paused';
    case 'transcription_resumed': return 'Transcription resumed';
    default: return `${name} — ${eventType}`;
  }
}

export default function ParticipantTimeline({ segments, participantEvents, isLive }) {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const viewportRef = useRef(null);

  const timeline = buildTimeline(segments || [], participantEvents || []);

  const handleScroll = useCallback(() => {
    if (!viewportRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
  }, []);

  const scrollToBottom = () => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  };

  if (timeline.length === 0) {
    return (
      <Card>
        <div className="timeline-empty">
          <p className="text-serif text-muted">
            No timeline data available
          </p>
        </div>
      </Card>
    );
  }

  const transcriptCount = timeline.filter(i => i.type === 'transcript').length;
  const eventCount = timeline.filter(i => i.type !== 'transcript').length;

  return (
    <Card className="timeline-card">
      <div className="timeline-header">
        <span className="text-sans text-sm text-muted">
          {eventCount} events &middot; {transcriptCount} transcript lines
        </span>
      </div>

      <ScrollArea.Root className="timeline-scroll-root">
        <ScrollArea.Viewport
          ref={viewportRef}
          className="timeline-viewport"
          onScroll={handleScroll}
        >
          {timeline.map((item, index) => {
            if (item.type === 'meeting-started') {
              return (
                <div key={`started-${index}`} className="timeline-system-event timeline-meeting-started">
                  <Users size={14} className="timeline-event-icon" />
                  <span className="timeline-event-text text-sans text-sm">{item.text}</span>
                  <span className="timeline-event-time text-mono text-xs">{formatTimestamp(item.timestamp)}</span>
                </div>
              );
            }

            if (item.type === 'participant-event') {
              return (
                <div
                  key={item.id || `evt-${index}`}
                  className={`timeline-system-event ${isLive ? 'timeline-event-animate' : ''}`}
                >
                  <EventIcon eventType={item.eventType} />
                  <span className="timeline-event-text text-sans text-sm">
                    <EventLabel eventType={item.eventType} name={item.participantName} />
                  </span>
                  <span className="timeline-event-time text-mono text-xs">{formatTimestamp(item.timestamp)}</span>
                </div>
              );
            }

            // Transcript segment
            return (
              <div key={item.id || `seg-${index}`} className="timeline-transcript-entry">
                <div className="timeline-transcript-header">
                  <span className="timeline-transcript-time text-mono text-xs text-muted">
                    {formatTimestamp(item.timestamp)}
                  </span>
                  <span className="timeline-transcript-speaker text-sans text-sm font-medium">
                    {item.speaker}
                  </span>
                </div>
                <p className="timeline-transcript-text text-serif text-sm">{item.text}</p>
              </div>
            );
          })}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="scroll-area-scrollbar">
          <ScrollArea.Thumb className="scroll-area-scrollbar-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      {!isAtBottom && (
        <div className="timeline-jump-bottom">
          <Button size="sm" variant="outline" onClick={scrollToBottom}>
            <ArrowDown size={12} />
            Jump to bottom
          </Button>
        </div>
      )}
    </Card>
  );
}
