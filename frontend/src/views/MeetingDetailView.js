import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, ScrollArea } from '@base-ui/react';
import { Download } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import './MeetingDetailView.css';

function formatTimestamp(ms) {
  const date = new Date(Number(ms));
  if (isNaN(date.getTime()) || ms === 0) return '--:--';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(ms) {
  if (!ms) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

export default function MeetingDetailView() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [segments, setSegments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const transcriptRef = useRef(null);

  // Fetch meeting data
  useEffect(() => {
    async function fetchData() {
      try {
        const [meetingRes, transcriptRes, highlightsRes] = await Promise.allSettled([
          fetch(`/api/meetings/${id}`, { credentials: 'include' }),
          fetch(`/api/meetings/${id}/transcript?limit=1000`, { credentials: 'include' }),
          fetch(`/api/highlights?meetingId=${id}`, { credentials: 'include' }),
        ]);

        if (meetingRes.status === 'fulfilled' && meetingRes.value.ok) {
          const data = await meetingRes.value.json();
          setMeeting(data.meeting);
        }

        if (transcriptRes.status === 'fulfilled' && transcriptRes.value.ok) {
          const data = await transcriptRes.value.json();
          setSegments(data.segments || []);
        }

        if (highlightsRes.status === 'fulfilled' && highlightsRes.value.ok) {
          const data = await highlightsRes.value.json();
          setHighlights(data.highlights || []);
        }
      } catch {
        // Failed to fetch
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  // Auto-generate summary when summary tab is shown
  useEffect(() => {
    if (activeTab !== 'summary' || summary || summaryLoading || !meeting) return;

    async function fetchSummary() {
      setSummaryLoading(true);
      try {
        const res = await fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ meetingId: id }),
        });
        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary);
        }

        const aiRes = await fetch('/api/ai/action-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ meetingId: id }),
        });
        if (aiRes.ok) {
          const data = await aiRes.json();
          setActionItems(data.actionItems || []);
        }
      } catch {
        // AI generation failed
      } finally {
        setSummaryLoading(false);
      }
    }

    fetchSummary();
  }, [activeTab, summary, summaryLoading, meeting, id]);

  const askQuestion = async () => {
    if (!question.trim()) return;
    setAnswerLoading(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ meetingId: id, question }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnswer(data.answer);
      }
    } catch {
      setAnswer('Failed to get answer. Please try again.');
    } finally {
      setAnswerLoading(false);
    }
  };

  const exportVTT = () => {
    window.open(`/api/meetings/${id}/vtt`, '_blank');
  };

  const exportMD = () => {
    window.open(`/api/meetings/${id}/export/markdown`, '_blank');
  };

  if (loading) {
    return (
      <div className="detail-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="detail-not-found">
        <p className="text-muted">Meeting not found</p>
      </div>
    );
  }

  const duration = meeting.duration
    ? formatDuration(meeting.duration)
    : meeting.endTime && meeting.startTime
      ? formatDuration(new Date(meeting.endTime) - new Date(meeting.startTime))
      : null;

  const speakers = meeting.speakers || [];

  // Compute participant durations from transcript segments
  const participantDurations = {};
  segments.forEach((seg) => {
    const name = seg.speaker?.displayName || seg.speaker?.label || 'Unknown';
    if (!participantDurations[name]) {
      participantDurations[name] = { first: seg.tStartMs, last: seg.tEndMs };
    } else {
      participantDurations[name].last = Math.max(participantDurations[name].last, seg.tEndMs);
    }
  });

  return (
    <div className="meeting-detail-view">
      {/* Header info */}
      <div className="detail-header">
        <h1 className="text-serif text-2xl">{meeting.title}</h1>
        <p className="text-sans text-sm text-muted">
          {new Date(meeting.startTime).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          {duration && ` \u2022 ${duration}`}
        </p>
      </div>

      {/* Export buttons */}
      <div className="detail-exports">
        <Button variant="outline" size="sm" onClick={exportVTT}>
          <Download size={12} />
          Export VTT
        </Button>
        <Button variant="outline" size="sm" onClick={exportMD}>
          <Download size={12} />
          Export MD
        </Button>
      </div>

      {/* 4-tab view */}
      <Tabs.Root defaultValue="summary" onValueChange={(val) => setActiveTab(val)}>
        <Tabs.List className="tabs-list" data-cols="4">
          <Tabs.Tab value="summary" className="tab-trigger">Summary</Tabs.Tab>
          <Tabs.Tab value="transcript" className="tab-trigger">Transcript</Tabs.Tab>
          <Tabs.Tab value="participants" className="tab-trigger">Participants</Tabs.Tab>
          <Tabs.Tab value="tasks" className="tab-trigger">Tasks</Tabs.Tab>
        </Tabs.List>

        {/* Summary tab */}
        <Tabs.Panel value="summary" className="detail-tab-panel">
          {summaryLoading ? (
            <Card className="detail-card">
              <div className="detail-card-inner detail-card-center">
                <LoadingSpinner />
                <span className="text-muted text-sm">Generating summary...</span>
              </div>
            </Card>
          ) : summary ? (
            <Card className="detail-card">
              <div className="detail-card-inner">
                <p className="text-serif text-muted text-sm summary-text">
                  {summary.overview}
                </p>
                {summary.keyPoints?.length > 0 && (
                  <ul className="summary-points">
                    {summary.keyPoints.map((point, i) => (
                      <li key={i} className="text-serif text-sm text-muted">{point}</li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ) : (
            <Card className="detail-card">
              <div className="detail-card-inner detail-card-center">
                <p className="text-muted text-sm">No transcript available for summary</p>
              </div>
            </Card>
          )}

          {/* Ask Q&A */}
          <Card className="detail-card">
            <div className="detail-card-inner">
              <h3 className="text-serif font-medium">Ask about this meeting</h3>
              <div className="qa-row">
                <Input
                  placeholder="What were the key decisions?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                />
                <Button onClick={askQuestion} disabled={answerLoading}>
                  {answerLoading ? '...' : 'Ask'}
                </Button>
              </div>
              {answer && (
                <div className="qa-answer">
                  <p className="text-serif text-sm text-muted">{answer}</p>
                </div>
              )}
            </div>
          </Card>
        </Tabs.Panel>

        {/* Transcript tab */}
        <Tabs.Panel value="transcript" className="detail-tab-panel">
          <Card className="transcript-card">
            <ScrollArea.Root>
              <ScrollArea.Viewport ref={transcriptRef} className="detail-transcript-viewport">
                {segments.length === 0 ? (
                  <p className="text-muted text-sm" style={{ padding: 20 }}>No transcript available</p>
                ) : (
                  segments.map((seg, index) => (
                    <div key={index} className="transcript-entry">
                      <div className="transcript-entry-header">
                        <span className="transcript-timestamp text-mono text-xs text-muted">
                          {formatTimestamp(seg.tStartMs)}
                        </span>
                        <span className="transcript-speaker text-sans text-sm font-medium">
                          {seg.speaker?.displayName || seg.speaker?.label || 'Speaker'}
                        </span>
                      </div>
                      <p className="transcript-text text-serif text-sm">{seg.text}</p>
                    </div>
                  ))
                )}
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar orientation="vertical" className="scroll-area-scrollbar">
                <ScrollArea.Thumb className="scroll-area-scrollbar-thumb" />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </Card>
        </Tabs.Panel>

        {/* Participants tab */}
        <Tabs.Panel value="participants" className="detail-tab-panel">
          {speakers.length === 0 ? (
            <p className="text-muted text-sm">No participant data available</p>
          ) : (
            <div className="participants-list">
              {speakers.map((speaker) => {
                const name = speaker.displayName || speaker.label;
                const pd = participantDurations[name];
                const durationMin = pd
                  ? Math.round((pd.last - pd.first) / 60000)
                  : null;
                return (
                  <Card key={speaker.id} className="participant-card">
                    <div className="participant-inner">
                      <p className="text-sans font-medium">{name}</p>
                      {durationMin != null && (
                        <p className="text-sans text-sm text-muted">{durationMin} minutes</p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Tabs.Panel>

        {/* Tasks tab */}
        <Tabs.Panel value="tasks" className="detail-tab-panel">
          {/* Highlights */}
          {highlights.length > 0 && (
            <Card className="detail-card">
              <div className="detail-card-inner">
                <h3 className="text-serif font-medium">Highlights</h3>
                <ul className="highlights-bullet-list">
                  {highlights.map((h) => (
                    <li key={h.id} className="text-serif text-sm text-muted">
                      <span className="text-accent">&#8226;</span> {h.title}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          {/* Action Items */}
          {actionItems.length > 0 ? (
            <Card className="detail-card">
              <div className="detail-card-inner">
                <h3 className="text-serif font-medium">Action Items</h3>
                <div className="action-items-detail">
                  {actionItems.map((item, i) => (
                    <div key={i} className="action-item-detail">
                      <p className="text-serif text-sm font-medium">{item.task}</p>
                      <div className="action-item-meta text-sans text-xs text-muted">
                        {item.owner && item.owner !== 'null' && <span>Owner: {item.owner}</span>}
                        {item.priority && <span className="text-accent">{item.priority}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="detail-card">
              <div className="detail-card-inner detail-card-center">
                {summaryLoading ? (
                  <>
                    <LoadingSpinner size={24} />
                    <span className="text-muted text-sm">Extracting action items...</span>
                  </>
                ) : (
                  <p className="text-muted text-sm">No action items found</p>
                )}
              </div>
            </Card>
          )}
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}
