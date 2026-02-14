import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ScrollArea } from '@base-ui/react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import useZoomAuth from '../hooks/useZoomAuth';
import './GuestInMeetingView.css';

function formatTimestamp(ms) {
  const date = new Date(Number(ms));
  if (isNaN(date.getTime()) || ms === 0) return '--:--';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function GuestInMeetingView() {
  const { id } = useParams();
  const { authorize } = useZoomAuth();
  const [meeting, setMeeting] = useState(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMeeting() {
      try {
        const [meetingRes, transcriptRes] = await Promise.allSettled([
          fetch(`/api/meetings/${id}`),
          fetch(`/api/meetings/${id}/transcript?limit=20`),
        ]);

        if (meetingRes.status === 'fulfilled' && meetingRes.value.ok) {
          const data = await meetingRes.value.json();
          setMeeting(data.meeting);
        }

        if (transcriptRes.status === 'fulfilled' && transcriptRes.value.ok) {
          const data = await transcriptRes.value.json();
          setSegments(data.segments || []);
        }
      } catch {
        // Failed to fetch
      } finally {
        setLoading(false);
      }
    }
    fetchMeeting();
  }, [id]);

  if (loading) {
    return (
      <div className="guest-in-meeting-loading">
        <LoadingSpinner />
      </div>
    );
  }

  const isLive = meeting?.status === 'live' || meeting?.isLive;

  return (
    <div className="guest-in-meeting">
      <div className="guest-meeting-content">
        {/* Meeting header */}
        <div className="guest-meeting-header">
          <div className="guest-meeting-title-row">
            {isLive && (
              <span className="guest-live-badge">
                <span className="guest-live-badge-dot" />
                Live
              </span>
            )}
            <h1 className="text-serif text-2xl">{meeting?.title || 'Meeting'}</h1>
          </div>
          <p className="text-sans text-sm text-muted">
            {meeting?.startTime && new Date(meeting.startTime).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Summary card */}
        <Card className="guest-summary-card">
          <div className="guest-summary-inner">
            <h3 className="text-serif font-medium">Summary</h3>
            {meeting?.summary ? (
              <p className="text-serif text-sm text-muted" style={{ lineHeight: 1.7 }}>
                {typeof meeting.summary === 'string'
                  ? meeting.summary
                  : meeting.summary.overview || 'Summary available after meeting ends.'}
              </p>
            ) : isLive ? (
              <div className="guest-summary-skeleton">
                <div className="guest-skeleton-line" />
                <div className="guest-skeleton-line" />
                <div className="guest-skeleton-line" />
                <p className="text-sans text-sm text-muted" style={{ paddingTop: 8 }}>
                  Summary generating...
                </p>
              </div>
            ) : (
              <p className="text-serif text-sm text-muted">
                Summary will be available after the meeting ends.
              </p>
            )}
          </div>
        </Card>

        {/* Read-only transcript preview */}
        {segments.length > 0 && (
          <Card className="guest-transcript-card">
            <div className="guest-transcript-fade" />
            <div className="guest-transcript-pill">
              <span>Sign in to see full transcript</span>
            </div>
            <ScrollArea.Root>
              <ScrollArea.Viewport className="guest-transcript-viewport">
                {segments.map((seg, index) => (
                  <div key={index} className="guest-transcript-entry">
                    <div className="guest-transcript-header">
                      <span className="text-mono text-xs text-muted">
                        {formatTimestamp(seg.tStartMs)}
                      </span>
                      <span className="text-sans text-sm font-medium">
                        {seg.speaker?.displayName || seg.speaker?.label || 'Speaker'}
                      </span>
                    </div>
                    <p className="guest-transcript-text text-serif text-sm">
                      {seg.text}
                    </p>
                  </div>
                ))}
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar orientation="vertical" className="scroll-area-scrollbar">
                <ScrollArea.Thumb className="scroll-area-scrollbar-thumb" />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </Card>
        )}

        {/* CTA card */}
        <Card className="guest-cta-card">
          <div className="guest-cta-inner">
            <div className="guest-cta-text">
              <h3 className="text-serif text-lg font-medium">
                Install Arlo for full access
              </h3>
              <ul className="guest-cta-features">
                <li>
                  <span className="text-accent">&#8226;</span>
                  <span>Real-time highlights and key decisions</span>
                </li>
                <li>
                  <span className="text-accent">&#8226;</span>
                  <span>AI chat to ask questions about the meeting</span>
                </li>
                <li>
                  <span className="text-accent">&#8226;</span>
                  <span>Full meeting history and search</span>
                </li>
              </ul>
            </div>
            <Button size="lg" className="guest-install-btn" onClick={() => authorize()}>
              Connect with Zoom
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
