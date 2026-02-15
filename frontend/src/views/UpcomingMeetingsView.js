import React, { useState, useEffect, useCallback } from 'react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import InfoBanner from '../components/InfoBanner';
import WarningBanner from '../components/WarningBanner';
import { useToast } from '../contexts/ToastContext';
import './UpcomingMeetingsView.css';

const MOCK_MEETINGS = [
  { id: 'u1', title: 'Weekly Product Sync', date: '2026-02-17T10:00:00Z', duration: 30, isRecurring: true, zoomMeetingId: '123-456-789', autoOpenEnabled: true },
  { id: 'u2', title: 'Q1 Planning Review', date: '2026-02-17T14:00:00Z', duration: 60, isRecurring: false, zoomMeetingId: '234-567-890', autoOpenEnabled: false },
  { id: 'u3', title: 'Engineering Standup', date: '2026-02-18T09:00:00Z', duration: 15, isRecurring: true, zoomMeetingId: '345-678-901', autoOpenEnabled: false },
  { id: 'u4', title: 'Design Review - Mobile App', date: '2026-02-19T11:00:00Z', duration: 45, isRecurring: false, zoomMeetingId: '456-789-012', autoOpenEnabled: false },
  { id: 'u5', title: 'Client Presentation', date: '2026-02-20T15:30:00Z', duration: 60, isRecurring: false, zoomMeetingId: '567-890-123', autoOpenEnabled: true },
  { id: 'u6', title: 'Team Retrospective', date: '2026-02-21T16:00:00Z', duration: 45, isRecurring: false, zoomMeetingId: '678-901-234', autoOpenEnabled: false },
  { id: 'u7', title: 'Marketing Strategy Session', date: '2026-02-24T13:00:00Z', duration: 90, isRecurring: false, zoomMeetingId: '789-012-345', autoOpenEnabled: false },
  { id: 'u8', title: '1:1 with Engineering Lead', date: '2026-02-25T10:00:00Z', duration: 30, isRecurring: true, zoomMeetingId: '890-123-456', autoOpenEnabled: false },
];

function formatDateTime(dateStr, duration) {
  const date = new Date(dateStr);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const startTime = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const endDate = new Date(date.getTime() + duration * 60000);
  const endTime = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${dayName}, ${monthDay} · ${startTime} – ${endTime}`;
}

export default function UpcomingMeetingsView() {
  const { addToast } = useToast();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [warningMeetingId, setWarningMeetingId] = useState(null);

  const fetchMeetings = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/zoom-meetings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings || []);
      } else {
        // Fall back to mock data if API isn't available
        setMeetings(MOCK_MEETINGS);
      }
    } catch {
      setMeetings(MOCK_MEETINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const toggleMeeting = async (meetingId) => {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;

    const wasEnabled = meeting.autoOpenEnabled;

    // Optimistic update
    setMeetings((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, autoOpenEnabled: !m.autoOpenEnabled } : m))
    );
    setWarningMeetingId(null);

    try {
      const method = wasEnabled ? 'DELETE' : 'POST';
      const res = await fetch(`/api/zoom-meetings/${meetingId}/auto-open`, {
        method,
        credentials: 'include',
      });

      if (res.status === 422) {
        // 3-app limit — revert
        setMeetings((prev) =>
          prev.map((m) => (m.id === meetingId ? { ...m, autoOpenEnabled: wasEnabled } : m))
        );
        setWarningMeetingId(meetingId);
        return;
      }

      if (!res.ok) throw new Error('API error');

      const label = wasEnabled ? 'disabled' : 'enabled';
      addToast(
        `Auto-open ${label} for ${meeting.title}`,
        'info',
        4000,
        () => toggleMeeting(meetingId) // undo
      );
    } catch {
      // If API fails, keep the optimistic state (mock mode)
    }
  };

  const enableAll = async () => {
    const toEnable = meetings.filter((m) => !m.autoOpenEnabled);
    if (toEnable.length === 0) return;

    // Optimistic update
    setMeetings((prev) => prev.map((m) => ({ ...m, autoOpenEnabled: true })));

    for (const m of toEnable) {
      try {
        await fetch(`/api/zoom-meetings/${m.id}/auto-open`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // continue with next
      }
    }

    addToast('Auto-open enabled for all meetings');
  };

  const enabledCount = meetings.filter((m) => m.autoOpenEnabled).length;

  if (loading) {
    return (
      <div className="upcoming-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="upcoming-view">
        <div className="upcoming-error">
          <p className="text-serif text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="upcoming-view">
      <div className="upcoming-header">
        <h1 className="text-serif text-2xl">Upcoming Meetings</h1>
        <p className="text-sans text-sm text-muted">
          Enable auto-open so Arlo launches automatically when a meeting starts
        </p>
      </div>

      {showInfoBanner && (
        <InfoBanner
          message="Auto-open requires the Zoom Apps Quick Launch setting to be enabled. Zoom allows up to 3 apps per meeting."
          onDismiss={() => setShowInfoBanner(false)}
        />
      )}

      <div className="upcoming-list">
        {meetings.map((meeting) => (
          <div key={meeting.id} className="upcoming-card-group">
            <Card className="upcoming-card">
              <div className="upcoming-card-inner">
                <div className="upcoming-card-content">
                  <div className="upcoming-card-title-row">
                    <h3 className="text-serif upcoming-card-title">{meeting.title}</h3>
                    {meeting.autoOpenEnabled && (
                      <Badge className="upcoming-auto-badge">Auto-open</Badge>
                    )}
                  </div>
                  <p className="text-sans upcoming-card-date">
                    {formatDateTime(meeting.date, meeting.duration)}
                  </p>
                  {(meeting.isRecurring || meeting.zoomMeetingId) && (
                    <p className="text-sans upcoming-card-meta">
                      {meeting.isRecurring && 'Recurring'}
                      {meeting.isRecurring && meeting.zoomMeetingId && ' · '}
                      {meeting.zoomMeetingId && `Zoom Meeting ID: ${meeting.zoomMeetingId}`}
                    </p>
                  )}
                </div>
                <div className="upcoming-card-toggle-col">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={meeting.autoOpenEnabled}
                      onChange={() => toggleMeeting(meeting.id)}
                    />
                    <span className="settings-toggle-track" />
                    <span className="settings-toggle-thumb" />
                  </label>
                  <span className="text-sans upcoming-toggle-label">Auto-open</span>
                </div>
              </div>
            </Card>

            {warningMeetingId === meeting.id && (
              <WarningBanner
                message="This meeting already has 3 auto-open apps (Zoom's limit). Remove another app first to add Arlo."
                onDismiss={() => setWarningMeetingId(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Sticky bottom bar */}
      <div className="upcoming-bottom-bar">
        <button onClick={enableAll} className="text-sans upcoming-enable-all">
          Enable auto-open for all
        </button>
        <p className="text-sans upcoming-count">
          {enabledCount} of {meetings.length} enabled
        </p>
      </div>
    </div>
  );
}
