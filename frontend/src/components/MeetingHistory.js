import React, { useState, useEffect } from 'react';
import './MeetingHistory.css';
import AIPanel from './AIPanel';

function MeetingHistory() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [expanded, setExpanded] = useState(true); // Start expanded by default
  const [activeTab, setActiveTab] = useState('transcript'); // Default to transcript tab
  const [transcript, setTranscript] = useState([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await fetch('/api/meetings?limit=10', {
        credentials: 'include', // Include cookies for authentication
      });
      if (!response.ok) throw new Error('Failed to fetch meetings');
      const data = await response.json();
      setMeetings(data.meetings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleSelectMeeting = (meeting) => {
    if (selectedMeeting?.id === meeting.id) {
      // Deselect if clicking same meeting
      setSelectedMeeting(null);
      setTranscript([]);
    } else {
      // Select new meeting and auto-fetch transcript
      setSelectedMeeting(meeting);
      setTranscript([]);
      setActiveTab('transcript'); // Default to transcript tab

      // Auto-fetch transcript if meeting has segments
      if (meeting._count?.segments > 0) {
        fetchTranscript(meeting.id);
      }
    }
  };

  const fetchTranscript = async (meetingId) => {
    if (transcriptLoading) return;

    setTranscriptLoading(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/transcript?limit=500`, {
        credentials: 'include', // Include cookies for authentication
      });
      if (!response.ok) throw new Error('Failed to fetch transcript');
      const data = await response.json();
      setTranscript(data.segments || []);
    } catch (err) {
      console.error('Failed to fetch transcript:', err);
    } finally {
      setTranscriptLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'transcript' && transcript.length === 0 && selectedMeeting) {
      fetchTranscript(selectedMeeting.id);
    }
  };

  const formatTimestamp = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="meeting-history">
        <div className="history-header" onClick={() => setExpanded(!expanded)}>
          <span className="history-title">📚 Past Meetings</span>
          <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
        </div>
        {expanded && (
          <div className="history-loading">
            <div className="loading-spinner"></div>
            <span>Loading meetings...</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="meeting-history">
      <div className="history-header" onClick={() => setExpanded(!expanded)}>
        <span className="history-title">📚 Past Meetings</span>
        <span className="meeting-count">{meetings.length}</span>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && meetings.length > 0 && !selectedMeeting && (
        <div className="history-hint">
          Click on a meeting to view its transcript and AI insights
        </div>
      )}

      {expanded && (
        <div className="history-content">
          {error && (
            <div className="history-error">
              <span>⚠️ {error}</span>
              <button onClick={() => { setError(null); fetchMeetings(); }}>Retry</button>
            </div>
          )}

          {meetings.length === 0 ? (
            <div className="no-meetings">
              No past meetings yet. Start recording to see your meeting history.
            </div>
          ) : (
            <>
              <ul className="meetings-list">
                {meetings.map((meeting) => (
                  <li
                    key={meeting.id}
                    className={`meeting-item ${selectedMeeting?.id === meeting.id ? 'selected' : ''}`}
                    onClick={() => handleSelectMeeting(meeting)}
                  >
                    <div className="meeting-info">
                      <span className="meeting-title">{meeting.title}</span>
                      <span className="meeting-meta">
                        {formatDate(meeting.startTime)}
                        {meeting._count?.segments > 0 && (
                          <span className="has-transcript">
                            • Transcript available
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="meeting-arrow">
                      {selectedMeeting?.id === meeting.id ? '▼' : '▶'}
                    </span>
                  </li>
                ))}
              </ul>

              {selectedMeeting && (
                <div className="selected-meeting-panel">
                  <div className="selected-meeting-header">
                    <h4>{selectedMeeting.title}</h4>
                    <button
                      className="export-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/api/meetings/${selectedMeeting.id}/vtt`, '_blank');
                      }}
                    >
                      Download VTT
                    </button>
                  </div>

                  <div className="meeting-detail-tabs">
                    <button
                      className={`detail-tab ${activeTab === 'ai' ? 'active' : ''}`}
                      onClick={() => handleTabChange('ai')}
                    >
                      AI Insights
                    </button>
                    <button
                      className={`detail-tab ${activeTab === 'transcript' ? 'active' : ''}`}
                      onClick={() => handleTabChange('transcript')}
                    >
                      Transcript
                    </button>
                  </div>

                  {activeTab === 'ai' && (
                    <AIPanel meetingId={selectedMeeting.id} />
                  )}

                  {activeTab === 'transcript' && (
                    <div className="transcript-viewer">
                      {transcriptLoading ? (
                        <div className="transcript-loading">
                          <div className="loading-spinner"></div>
                          <span>Loading transcript...</span>
                        </div>
                      ) : transcript.length === 0 ? (
                        <div className="no-transcript">
                          No transcript available for this meeting.
                        </div>
                      ) : (
                        <div className="transcript-content">
                          {transcript.map((line, index) => (
                            <div key={index} className="transcript-line">
                              <div className="line-header">
                                <span className="line-speaker">
                                  {line.speaker?.displayName || line.speaker?.label || 'Speaker'}
                                </span>
                                <span className="line-time">
                                  {formatTimestamp(Number(line.tStartMs))}
                                </span>
                              </div>
                              <div className="line-text">{line.text}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default MeetingHistory;
