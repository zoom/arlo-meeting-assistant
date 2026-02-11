import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMeeting } from '../contexts/MeetingContext';
import './LiveMeetingBanner.css';

export default function LiveMeetingBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { rtmsActive, meetingId } = useMeeting();

  // Don't show if not in active meeting or already on the in-meeting view
  if (!rtmsActive || !meetingId) return null;
  if (location.pathname.startsWith('/meeting/')) return null;

  return (
    <div className="live-meeting-banner" onClick={() => navigate(`/meeting/${encodeURIComponent(meetingId)}`)}>
      <div className="live-banner-left">
        <div className="live-dot-container">
          <div className="live-dot" />
          <div className="live-dot-ping" />
        </div>
        <span className="live-banner-text">Live meeting in progress</span>
      </div>
      <span className="live-banner-link">Return to live transcript &rarr;</span>
    </div>
  );
}
