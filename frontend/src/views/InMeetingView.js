import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, ScrollArea } from '@base-ui/react';
import { ArrowDown, X, Sparkles, Pause, Play, Square } from 'lucide-react';
import { useMeeting } from '../contexts/MeetingContext';
import { useAuth } from '../contexts/AuthContext';
import { useZoomSdk } from '../contexts/ZoomSdkContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Textarea from '../components/ui/Textarea';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import './InMeetingView.css';

function formatTimestamp(ms) {
  const date = new Date(ms);
  if (isNaN(date.getTime()) || ms === 0) return '--:--';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function InMeetingView() {
  useParams(); // id available from route but meetingId comes from context
  const { ws, rtmsActive, rtmsLoading, startRTMS, stopRTMS, meetingId, connectWebSocket } = useMeeting();
  const { isAuthenticated, login } = useAuth();
  const { zoomSdk, userContext, meetingContext, isTestMode, runningContext } = useZoomSdk();

  const [segments, setSegments] = useState([]);
  const [followLive, setFollowLive] = useState(true);
  const [paused, setPaused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [notes, setNotes] = useState('');
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const transcriptRef = useRef(null);

  // Auth flow for in-meeting (mirrors ZoomApp.js logic)
  const authAttemptedRef = useRef(false);
  useEffect(() => {
    if (isTestMode || isAuthenticated || authAttemptedRef.current) return;
    if (runningContext !== 'inMeeting' || !userContext || !meetingContext?.meetingUUID) return;

    authAttemptedRef.current = true;

    async function authenticate() {
      try {
        if (userContext?.status === 'authorized') {
          login({
            displayName: userContext.screenName,
            participantId: userContext.participantId,
          });
          connectWebSocket(null, meetingContext.meetingUUID);
          return;
        }

        const response = await fetch('/api/auth/authorize');
        const { codeChallenge, state } = await response.json();
        await zoomSdk.authorize({ codeChallenge, state });

        zoomSdk.onAuthorized(async (event) => {
          const { code, state: returnedState } = event;
          const callbackResponse = await fetch('/api/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code, state: returnedState }),
          });
          const data = await callbackResponse.json();
          login(data.user);
          connectWebSocket(data.wsToken, meetingContext.meetingUUID);
        });
      } catch (error) {
        console.error('Auth error:', error);
      }
    }

    authenticate();
  }, [isTestMode, isAuthenticated, runningContext, userContext, meetingContext, zoomSdk, login, connectWebSocket]);

  // Ensure WebSocket is connected when already authenticated (e.g. navigated from Home)
  useEffect(() => {
    if (!isAuthenticated || ws || !meetingId) return;
    connectWebSocket(null, meetingId);
  }, [isAuthenticated, ws, meetingId, connectWebSocket]);

  // Auto-start RTMS
  const autoStartRef = useRef(false);
  useEffect(() => {
    if (autoStartRef.current || !isAuthenticated || !meetingId || rtmsActive || rtmsLoading) return;
    autoStartRef.current = true;
    const timer = setTimeout(() => startRTMS(true), 1500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, meetingId, rtmsActive, rtmsLoading, startRTMS]);

  // Listen for transcript segments
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'transcript.segment') {
        const { segment } = message.data;
        setSegments((prev) => [...prev, segment]);

        if (followLive && transcriptRef.current) {
          requestAnimationFrame(() => {
            if (transcriptRef.current) {
              transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
            }
          });
        }
      }

      if (message.type === 'ai.suggestion') {
        setSuggestions((prev) => [...prev, message.data.suggestion].slice(-3));
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, followLive]);

  // Scroll detection
  const handleScroll = useCallback(() => {
    if (!transcriptRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = transcriptRef.current;
    setFollowLive(scrollHeight - scrollTop - clientHeight < 100);
  }, []);

  const scrollToLive = () => {
    setFollowLive(true);
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  };

  const dismissSuggestion = (index) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now().toString(), task: newTask, owner: 'Unassigned' }]);
    setNewTask('');
  };

  const handlePause = () => {
    stopRTMS();
    setPaused(true);
  };

  const handleResume = () => {
    startRTMS(false);
    setPaused(false);
  };

  const handleStop = () => {
    stopRTMS();
    setPaused(false);
  };

  // Determine transcript state
  const transcriptState = paused
    ? 'paused'
    : rtmsActive && segments.length > 0
      ? 'live'
      : rtmsActive
        ? 'waiting'
        : 'not-started';

  // Get meeting title (from meetingContext or URL)
  const title = meetingContext?.meetingTopic || 'Live Meeting';
  const participants = []; // TODO: from Zoom SDK getMeetingParticipants

  return (
    <div className="in-meeting-view">
      {/* Meeting header */}
      <div className="in-meeting-header">
        <div className="live-indicator-row">
          <div className="live-dot-container">
            <div className="live-dot" />
            <div className="live-dot-ping" />
          </div>
          <h1 className="text-serif text-2xl">{title}</h1>
        </div>
        {participants.length > 0 && (
          <p className="text-sans text-sm text-muted">{participants.join(', ')}</p>
        )}
      </div>

      {/* Tabs: Transcript | Arlo Assist */}
      <Tabs.Root defaultValue="transcript">
        <Tabs.List className="tabs-list" data-cols="2">
          <Tabs.Tab value="transcript" className="tab-trigger">Transcript</Tabs.Tab>
          <Tabs.Tab value="assist" className="tab-trigger">Arlo Assist</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="transcript" className="in-meeting-tab-panel">
          {transcriptState === 'not-started' && (
            <Card className="transcript-state-card">
              <div className="transcript-state-inner">
                <p className="text-serif text-muted">Transcription not started</p>
                <Button onClick={() => startRTMS(false)} disabled={rtmsLoading}>
                  {rtmsLoading ? 'Starting...' : 'Start Transcription'}
                </Button>
              </div>
            </Card>
          )}

          {transcriptState === 'waiting' && (
            <Card className="transcript-state-card">
              <div className="transcript-state-inner">
                <LoadingSpinner size={32} />
                <p className="text-serif text-muted">Waiting for transcript...</p>
              </div>
            </Card>
          )}

          {(transcriptState === 'live' || transcriptState === 'paused') && (
            <div className="transcript-active-container">
              {/* Transcription controls bar */}
              <Card className="transcript-controls-card">
                <div className="transcript-controls">
                  <div className="transcript-status">
                    {transcriptState === 'live' ? (
                      <>
                        <div className="live-dot-container">
                          <div className="live-dot" />
                          <div className="live-dot-ping" />
                        </div>
                        <span className="text-sans text-sm text-muted">Transcribing</span>
                      </>
                    ) : (
                      <>
                        <div className="paused-dot" />
                        <span className="text-sans text-sm text-muted">Paused</span>
                      </>
                    )}
                  </div>
                  <div className="transcript-controls-buttons">
                    {transcriptState === 'live' ? (
                      <>
                        <Button variant="outline" size="sm" onClick={handlePause} disabled={rtmsLoading}>
                          <Pause size={12} />
                          Pause
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleStop} disabled={rtmsLoading}>
                          <Square size={12} />
                          Stop
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={handleResume} disabled={rtmsLoading}>
                          <Play size={12} />
                          Resume
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleStop} disabled={rtmsLoading}>
                          <Square size={12} />
                          Stop
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>

              {/* Transcript card */}
              <Card className="transcript-live-card">
                <ScrollArea.Root className="transcript-scroll-root">
                  <ScrollArea.Viewport
                    ref={transcriptRef}
                    className="transcript-viewport"
                    onScroll={handleScroll}
                  >
                    {segments.map((segment, index) => (
                      <div key={index} className="transcript-entry">
                        <div className="transcript-entry-header">
                          <span className="transcript-timestamp text-mono text-xs text-muted">
                            {formatTimestamp(segment.tStartMs)}
                          </span>
                          <span className="transcript-speaker text-sans text-sm font-medium">
                            {segment.speakerLabel}
                          </span>
                        </div>
                        <p className="transcript-text text-serif text-sm">
                          {segment.text}
                        </p>
                      </div>
                    ))}
                  </ScrollArea.Viewport>
                  <ScrollArea.Scrollbar orientation="vertical" className="scroll-area-scrollbar">
                    <ScrollArea.Thumb className="scroll-area-scrollbar-thumb" />
                  </ScrollArea.Scrollbar>
                </ScrollArea.Root>

                {/* Suggestion bubbles */}
                {suggestions.length > 0 && (
                  <div className="suggestion-bubbles">
                    {suggestions.map((s, i) => (
                      <Card key={i} className="suggestion-bubble">
                        <div className="suggestion-inner">
                          <Sparkles size={14} className="text-accent" />
                          <span className="text-sans text-sm">{s.text}</span>
                          <button className="suggestion-dismiss" onClick={() => dismissSuggestion(i)}>
                            <X size={14} />
                          </button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Scroll to live */}
                {!followLive && transcriptState === 'live' && (
                  <div className="scroll-to-live">
                    <Button size="sm" onClick={scrollToLive}>
                      <ArrowDown size={12} />
                      Scroll to live
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="assist" className="in-meeting-tab-panel">
          <Card className="assist-card">
            <div className="assist-card-inner">
              <h3 className="text-serif font-medium">Notes</h3>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Meeting notes..."
                className="assist-notes"
              />
            </div>
          </Card>

          <Card className="assist-card">
            <div className="assist-card-inner">
              <h3 className="text-serif font-medium">Action Items</h3>

              <div className="action-items-list">
                {tasks.map((task) => (
                  <div key={task.id} className="action-item">
                    <p className="text-serif text-sm">{task.task}</p>
                    <p className="text-sans text-xs text-muted">Owner: {task.owner}</p>
                  </div>
                ))}
              </div>

              <div className="add-action-row">
                <Input
                  placeholder="Add action item..."
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTask()}
                />
                <Button size="sm" onClick={addTask}>Add</Button>
              </div>
            </div>
          </Card>
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}
