import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMeeting } from '../contexts/MeetingContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import './HomeView.css';

// TODO: Replace with API endpoint when available
const mockWeeklyDigest = {
  meetingCount: 7,
  totalTime: '5.2h',
  topTopics: ['Product Strategy', 'Technical Planning', 'Q1 Review'],
  summary: 'This week focused on Q1 planning and product roadmap alignment. Key decisions around mobile app priorities and hiring timeline were finalized.',
};

// TODO: Replace with API endpoint when available
const mockActionItems = [
  { id: '1', task: 'Finalize mobile design mockups', owner: 'Sarah Chen', meeting: 'Product Strategy Q1 Review', meetingId: '1', done: false, due: 'Feb 15' },
  { id: '2', task: 'Review notification system architecture', owner: 'Marcus Johnson', meeting: 'Technical Planning', meetingId: '2', done: false },
  { id: '3', task: 'Send client proposal draft', owner: 'Elena Rodriguez', meeting: 'Client Check-in', meetingId: '3', done: true },
];

// TODO: Replace with API endpoint when available
const mockRecurringTopics = ['Q3 Budget', 'Hiring', 'Product Launch', 'Mobile App'];

export default function HomeView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { meetingId, rtmsActive, rtmsLoading, startRTMS } = useMeeting();
  const [highlights, setHighlights] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionItems, setActionItems] = useState(mockActionItems);

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

  const toggleActionItem = (id) => {
    setActionItems(items =>
      items.map(item =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    );
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
  const firstName = user?.displayName?.split(' ')[0];

  return (
    <div className="home-view">
      <div className="home-greeting">
        <h1 className="text-serif text-2xl">
          {firstName ? `Hi, ${firstName}` : 'Welcome'}
        </h1>
      </div>

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
          {/* Weekly Digest */}
          <section className="home-section">
            <h2 className="text-serif home-section-title">Your week in review</h2>
            <Card>
              <div className="home-digest-card">
                <div className="home-digest-stats">
                  <div>
                    <div className="home-digest-stat-number">{mockWeeklyDigest.meetingCount}</div>
                    <p className="home-digest-stat-label">Meetings</p>
                  </div>
                  <div>
                    <div className="home-digest-stat-number">{mockWeeklyDigest.totalTime}</div>
                    <p className="home-digest-stat-label">Total time</p>
                  </div>
                </div>

                <div>
                  <p className="home-topics-label">Top topics</p>
                  <div className="home-topics-row">
                    {mockWeeklyDigest.topTopics.map((topic, i) => (
                      <Badge key={i} variant="default">{topic}</Badge>
                    ))}
                  </div>
                </div>

                <p className="text-serif text-sm text-muted home-digest-summary">
                  {mockWeeklyDigest.summary}
                </p>
              </div>
            </Card>
          </section>

          {/* Action Items */}
          <section className="home-section">
            <h2 className="text-serif home-section-title">Action items this week</h2>
            <div className="home-cards">
              {actionItems.filter(item => !item.done).map((item) => (
                <Card key={item.id}>
                  <div className="home-action-card">
                    <div className="home-action-item">
                      <input
                        type="checkbox"
                        className="home-action-checkbox"
                        checked={item.done}
                        onChange={() => toggleActionItem(item.id)}
                      />
                      <div className="home-action-content">
                        <p className="text-serif text-sm">{item.task}</p>
                        <div className="home-action-meta">
                          <span>Owner: {item.owner}</span>
                          {item.due && (
                            <>
                              <span>&bull;</span>
                              <span>Due: {item.due}</span>
                            </>
                          )}
                          <span>&bull;</span>
                          <button
                            className="home-action-meeting-link"
                            onClick={() => navigate(`/meetings/${item.meetingId}`)}
                          >
                            {item.meeting}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Recurring Topics */}
          <section className="home-section">
            <h2 className="text-serif home-section-title">Recurring topics</h2>
            <Card>
              <div className="home-recurring-inner">
                <p className="text-sans text-xs text-muted">
                  Topics mentioned in 2+ meetings this week
                </p>
                <div className="home-recurring-badges">
                  {mockRecurringTopics.map((topic, i) => (
                    <Badge key={i} variant="outline" className="home-recurring-badge">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </section>

          {/* Existing highlights */}
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

          {/* Existing reminders */}
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
