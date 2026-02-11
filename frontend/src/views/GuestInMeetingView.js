import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import './GuestInMeetingView.css';

export default function GuestInMeetingView() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMeeting() {
      try {
        const res = await fetch(`/api/meetings/${id}`);
        if (res.ok) {
          const data = await res.json();
          setMeeting(data.meeting);
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

  return (
    <div className="guest-in-meeting">
      <div className="guest-meeting-content">
        <h1 className="text-serif text-2xl">{meeting?.title || 'Meeting'}</h1>
        <p className="text-muted text-sm">
          {meeting?.startTime && new Date(meeting.startTime).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        {meeting && (
          <Card className="guest-summary-card">
            <div className="guest-summary-inner">
              <h3 className="text-serif font-medium">Meeting Summary</h3>
              <p className="text-serif text-muted text-sm">
                Summary will be available after the meeting ends.
              </p>
            </div>
          </Card>
        )}

        <Button size="lg" className="guest-install-btn">
          Install Arlo
        </Button>
      </div>
    </div>
  );
}
