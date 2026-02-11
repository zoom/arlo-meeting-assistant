import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MeetingCard from '../components/MeetingCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import './MeetingsListView.css';

export default function MeetingsListView() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMeetings() {
      try {
        const res = await fetch('/api/meetings', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setMeetings(data.meetings || []);
        }
      } catch {
        // Failed to fetch
      } finally {
        setLoading(false);
      }
    }
    fetchMeetings();
  }, []);

  if (loading) {
    return (
      <div className="meetings-loading">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="meetings-list-view">
      {meetings.length === 0 ? (
        <div className="meetings-empty">
          <p className="text-serif text-muted">No meetings yet</p>
          <p className="text-muted text-sm">
            Start a Zoom meeting with Arlo to see your meeting history.
          </p>
        </div>
      ) : (
        <div className="meetings-list">
          {meetings.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onClick={() => {
                if (meeting.status === 'ongoing') {
                  navigate(`/meeting/${encodeURIComponent(meeting.zoomMeetingId)}`);
                } else {
                  navigate(`/meetings/${meeting.id}`);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
