import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { useMeeting } from '../contexts/MeetingContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import './HomeView.css';

export default function HomeView() {
  const navigate = useNavigate();
  const { meetingId, rtmsActive, rtmsLoading, startRTMS } = useMeeting();
  const [highlights, setHighlights] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHomeData() {
      try {
        const [highlightsRes, remindersRes] = await Promise.allSettled([
          fetch('/api/home/highlights', { credentials: 'include' }),
          fetch('/api/home/reminders', { credentials: 'include' }),
        ]);

        if (highlightsRes.status === 'fulfilled' && highlightsRes.value.ok) {
          const data = await highlightsRes.value.json();
          setHighlights(data.highlights || []);
        }

        if (remindersRes.status === 'fulfilled' && remindersRes.value.ok) {
          const data = await remindersRes.value.json();
          setReminders(data.reminders || []);
        }
      } catch {
        // Failed to fetch home data
      } finally {
        setLoading(false);
      }
    }
    fetchHomeData();
  }, []);

  const handleStartTranscription = () => {
    startRTMS(false);
    if (meetingId) {
      navigate(`/meeting/${encodeURIComponent(meetingId)}`);
    }
  };

  if (loading) {
    return (
      <div className="home-loading">
        <LoadingSpinner />
      </div>
    );
  }

  const hasContent = highlights.length > 0 || reminders.length > 0;
  const showMeetingInProgress = meetingId && !rtmsActive;

  return (
    <div className="home-view">
      {showMeetingInProgress && (
        <Card className="home-meeting-card">
          <div className="home-meeting-inner">
            <div className="home-meeting-text">
              <h2 className="text-serif">Meeting in Progress</h2>
              <p className="text-sans text-sm text-muted">
                Start transcription to capture this meeting
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleStartTranscription}
              disabled={rtmsLoading}
              className="home-start-btn"
            >
              <Mic size={16} />
              {rtmsLoading ? 'Starting...' : 'Start Transcription'}
            </Button>
          </div>
        </Card>
      )}

      {!hasContent ? (
        <div className="home-empty">
          <p className="text-serif text-muted">No meetings yet this week.</p>
          <p className="text-muted text-sm">Start a Zoom meeting with Arlo to see highlights here.</p>
        </div>
      ) : (
        <>
          {highlights.length > 0 && (
            <section className="home-section">
              <h2 className="text-serif home-section-title">This week's highlights</h2>
              <div className="home-cards">
                {highlights.map((h, i) => (
                  <Card key={i} className="home-highlight-card" onClick={() => h.meetingId && navigate(`/meetings/${h.meetingId}`)}>
                    <div className="home-card-inner">
                      <h4 className="text-serif font-medium">{h.title}</h4>
                      <p className="text-muted text-sm">{h.snippet}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {reminders.length > 0 && (
            <section className="home-section">
              <h2 className="text-serif home-section-title">Reminders from yesterday</h2>
              <div className="home-cards">
                {reminders.map((r, i) => (
                  <Card key={i} className="home-reminder-card">
                    <div className="home-card-inner">
                      <p className="text-serif text-sm">{r.task}</p>
                      {r.owner && <p className="text-muted text-xs">Owner: {r.owner}</p>}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Button
        variant="outline"
        onClick={() => navigate('/meetings')}
        className="home-view-all-btn"
      >
        View all meetings
      </Button>
    </div>
  );
}
