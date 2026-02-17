import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, ScrollArea } from '@base-ui/react';
import { ArrowDown, X, Sparkles, Pause, Play, Square, LogIn, LogOut, Mic, MicOff, Share2, Check, Users, Pencil, Loader2 } from 'lucide-react';
import { useMeeting } from '../contexts/MeetingContext';
import { useAuth } from '../contexts/AuthContext';
import { useZoomSdk } from '../contexts/ZoomSdkContext';
import { useToast } from '../contexts/ToastContext';
import useZoomAuth from '../hooks/useZoomAuth';
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

function InlineEventIcon({ eventType }) {
  const cls = "transcript-event-icon";
  switch (eventType) {
    case 'joined': return <LogIn size={14} className={cls} />;
    case 'left': return <LogOut size={14} className={cls} />;
    case 'transcription_started': return <Mic size={14} className={cls} />;
    case 'transcription_stopped': return <MicOff size={14} className={cls} />;
    case 'transcription_paused': return <Pause size={14} className={cls} />;
    case 'transcription_resumed': return <Play size={14} className={cls} />;
    default: return <Mic size={14} className={cls} />;
  }
}

function InlineEventLabel({ eventType, name }) {
  switch (eventType) {
    case 'joined': return `${name} joined the meeting`;
    case 'left': return `${name} left the meeting`;
    case 'transcription_started': return 'Transcription started';
    case 'transcription_stopped': return 'Transcription stopped';
    case 'transcription_paused': return 'Transcription paused';
    case 'transcription_resumed': return 'Transcription resumed';
    default: return `${name} — ${eventType}`;
  }
}

export default function InMeetingView() {
  useParams(); // id available from route but meetingId comes from context
  const navigate = useNavigate();
  const { ws, rtmsActive, rtmsPaused, rtmsLoading, startRTMS, stopRTMS, pauseRTMS, resumeRTMS, meetingId, connectWebSocket, viewers, setTitleUserRenamed } = useMeeting();
  const { isAuthenticated, wsToken } = useAuth();
  const { zoomSdk, meetingContext, isTestMode, runningContext } = useZoomSdk();
  const { authorize } = useZoomAuth();

  // Context guard: redirect to home if not in a meeting
  useEffect(() => {
    if (isTestMode) return;
    if (runningContext === null) return; // SDK still loading
    if (runningContext !== 'inMeeting') {
      navigate('/home', { replace: true });
    }
  }, [isTestMode, runningContext, navigate]);

  const { addToast } = useToast();
  const [segments, setSegments] = useState([]);
  const [participantEvents, setParticipantEvents] = useState([]);
  const [followLive, setFollowLive] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [notes, setNotes] = useState('');
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [inviteMenuOpen, setInviteMenuOpen] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(null);
  const transcriptRef = useRef(null);
  const inviteDropdownRef = useRef(null);

  // Auto-authenticate when entering meeting without a session
  const authAttemptedRef = useRef(false);
  useEffect(() => {
    if (isTestMode || isAuthenticated || authAttemptedRef.current) return;
    if (runningContext !== 'inMeeting' || !meetingContext?.meetingUUID) return;

    authAttemptedRef.current = true;
    authorize().catch((err) => console.error('Auth error:', err));
  }, [isTestMode, isAuthenticated, runningContext, meetingContext, authorize]);

  // Connect WebSocket when authenticated and meeting is available
  useEffect(() => {
    if (!isAuthenticated || ws || !meetingId) return;
    connectWebSocket(wsToken, meetingId);
  }, [isAuthenticated, ws, meetingId, wsToken, connectWebSocket]);

  // Load existing transcript segments from DB (for auto-started RTMS sessions)
  const historicalLoadedRef = useRef(false);
  useEffect(() => {
    if (!rtmsActive || !meetingId || historicalLoadedRef.current) return;
    historicalLoadedRef.current = true;

    fetch(`/api/meetings/by-zoom-id/${encodeURIComponent(meetingId)}/transcript`, {
      credentials: 'include',
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.segments?.length > 0) {
          setSegments(prev => {
            // Merge: DB segments first, then any WS segments not already present
            const dbSeqs = new Set(data.segments.map(s => s.seqNo));
            const newFromWs = prev.filter(s => !dbSeqs.has(String(s.seqNo)));
            return [...data.segments, ...newFromWs];
          });
          console.log(`Loaded ${data.segments.length} historical segments from DB`);
        }
      })
      .catch(() => {});
  }, [rtmsActive, meetingId]);

  // Load existing participant events from DB (for mid-meeting app opens)
  const historicalEventsLoadedRef = useRef(false);
  useEffect(() => {
    if (!rtmsActive || !meetingId || historicalEventsLoadedRef.current) return;
    historicalEventsLoadedRef.current = true;

    fetch(`/api/meetings/by-zoom-id/${encodeURIComponent(meetingId)}/participant-events`, {
      credentials: 'include',
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.events?.length > 0) {
          setParticipantEvents(prev => {
            // Merge: DB events first, then any WS events not already present
            const dbIds = new Set(data.events.map(e => e.id));
            const newFromWs = prev.filter(e => !dbIds.has(e.id));
            return [...data.events, ...newFromWs];
          });
          console.log(`Loaded ${data.events.length} historical participant events from DB`);
        }
      })
      .catch(() => {});
  }, [rtmsActive, meetingId]);

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

      if (message.type === 'participant.event') {
        const evt = message.data.event;
        setParticipantEvents((prev) => [...prev, evt]);

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

  // Invite handlers
  const handleInviteAll = useCallback(async () => {
    if (!zoomSdk?.sendAppInvitationToAllParticipants) return;
    try {
      await zoomSdk.sendAppInvitationToAllParticipants();
      setInviteSent(true);
      setInviteMenuOpen(false);
      addToast('Invitation sent to all participants', 'success');
      setTimeout(() => setInviteSent(false), 3000);
    } catch (err) {
      console.error('sendAppInvitationToAllParticipants failed:', err);
      addToast('Failed to send invitation', 'error');
    }
  }, [zoomSdk, addToast]);

  const handleInviteChoose = useCallback(() => {
    if (!zoomSdk?.showAppInvitationDialog) return;
    zoomSdk.showAppInvitationDialog().catch((err) => {
      console.error('showAppInvitationDialog failed:', err);
    });
    setInviteMenuOpen(false);
  }, [zoomSdk]);

  // Close invite dropdown on click outside
  useEffect(() => {
    if (!inviteMenuOpen) return;
    const handleClickOutside = (e) => {
      if (inviteDropdownRef.current && !inviteDropdownRef.current.contains(e.target)) {
        setInviteMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inviteMenuOpen]);

  // Register onSendAppInvitation listener for confirmation
  useEffect(() => {
    if (!zoomSdk?.onSendAppInvitation) return;
    const handler = () => {
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 3000);
    };
    zoomSdk.onSendAppInvitation(handler);
  }, [zoomSdk]);

  const handlePause = () => {
    pauseRTMS();
  };

  const handleResume = () => {
    resumeRTMS();
  };

  const handleStop = () => {
    stopRTMS();
  };

  // Determine transcript state (initial_roster events don't count as displayable content)
  const hasContent = segments.length > 0 || participantEvents.some(e => e.eventType !== 'initial_roster');
  const transcriptState = rtmsPaused
    ? 'paused'
    : rtmsActive && hasContent
      ? 'live'
      : rtmsActive
        ? 'waiting'
        : 'not-started';

  // Merge transcript segments and participant events into a chronological timeline
  // Filter out initial_roster events — they're not real joins, just the SDK reporting existing participants
  const timelineItems = useMemo(() => {
    const items = [];
    segments.forEach((seg, i) => {
      items.push({ type: 'transcript', ...seg, _ts: seg.tStartMs, _key: `seg-${i}` });
    });
    participantEvents
      .filter(evt => evt.eventType !== 'initial_roster')
      .forEach((evt, i) => {
        items.push({ type: 'participant-event', ...evt, _ts: evt.timestamp, _key: `evt-${i}` });
      });
    items.sort((a, b) => a._ts - b._ts);
    return items;
  }, [segments, participantEvents]);

  // Early return while redirecting (after all hooks)
  if (!isTestMode && runningContext !== null && runningContext !== 'inMeeting') {
    return null;
  }

  // Title editing handlers
  const handleEditTitle = () => {
    setIsEditingTitle(true);
    setEditedTitle(displayTitle || meetingContext?.meetingTopic || 'Live Meeting');
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === (displayTitle || meetingContext?.meetingTopic || 'Live Meeting')) {
      setIsEditingTitle(false);
      return;
    }
    setIsSavingTitle(true);
    try {
      const res = await fetch(`/api/meetings/by-zoom-id/${encodeURIComponent(meetingId)}/topic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: editedTitle, force: true }),
      });
      if (res.ok) {
        setDisplayTitle(editedTitle);
        setTitleUserRenamed();
        addToast('Meeting renamed', 'success');
      } else {
        addToast('Failed to rename meeting', 'error');
      }
    } catch {
      addToast('Failed to rename meeting', 'error');
    } finally {
      setIsSavingTitle(false);
      setIsEditingTitle(false);
    }
  };

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
  };

  const handleGenerateTitle = async (e) => {
    e.stopPropagation();
    setIsGeneratingTitle(true);
    try {
      const res = await fetch('/api/ai/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ meetingId }),
      });
      if (res.ok) {
        const data = await res.json();
        setEditedTitle(data.title);
        setIsEditingTitle(true);
      } else {
        addToast('Failed to generate title', 'error');
      }
    } catch {
      addToast('Failed to generate title', 'error');
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  // Get meeting title (user rename > Zoom topic > fallback)
  const title = displayTitle || meetingContext?.meetingTopic || 'Live Meeting';
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
          {isAuthenticated && isEditingTitle ? (
            <div className="title-edit-row">
              <input
                type="text"
                className="input title-edit-input text-serif text-2xl"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') handleCancelEditTitle();
                }}
                autoFocus
                onFocus={(e) => e.target.select()}
              />
              <Button variant="ghost" size="icon" onClick={handleSaveTitle} disabled={isSavingTitle}>
                {isSavingTitle ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleCancelEditTitle} disabled={isSavingTitle}>
                <X size={16} />
              </Button>
            </div>
          ) : isAuthenticated ? (
            <div className="title-display" onClick={handleEditTitle}>
              <h1 className="text-serif text-2xl">{title}</h1>
              <Pencil size={16} className="title-action text-muted" />
              <button
                className="title-action-btn"
                onClick={handleGenerateTitle}
                disabled={isGeneratingTitle}
                title="Generate title with AI"
              >
                {isGeneratingTitle
                  ? <Loader2 size={16} className="spin text-muted" />
                  : <Sparkles size={16} className="title-action text-muted" />
                }
              </button>
            </div>
          ) : (
            <h1 className="text-serif text-2xl">{title}</h1>
          )}
        </div>
        {participants.length > 0 && (
          <p className="text-sans text-sm text-muted">{participants.join(', ')}</p>
        )}
        {viewers && viewers.guestCount > 0 && (
          <span className="viewer-count text-sans text-xs text-muted">
            <Users size={12} />
            {viewers.guestCount} {viewers.guestCount === 1 ? 'guest' : 'guests'} viewing
          </span>
        )}
      </div>

      {/* Tabs: Transcript | Arlo Assist */}
      <Tabs.Root defaultValue="transcript" className="in-meeting-tabs">
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
                          <div className="recording-dot" />
                          <div className="recording-dot-ping" />
                        </div>
                        <span className="text-sans text-sm text-muted">Transcribing</span>
                      </>
                    ) : (
                      <span className="paused-badge text-sans">Paused</span>
                    )}
                  </div>
                  <div className="transcript-controls-buttons">
                    {transcriptState === 'live' ? (
                      <>
                        <Button variant="outline" size="sm" onClick={handlePause} disabled={rtmsLoading}>
                          <Pause size={12} />
                          Pause
                        </Button>
                        <Button variant="outline" size="sm" className="btn-destructive-outline" onClick={handleStop} disabled={rtmsLoading}>
                          <Square size={12} />
                          Stop
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={handleResume} disabled={rtmsLoading}>
                          <Play size={12} />
                          Resume
                        </Button>
                        <Button variant="outline" size="sm" className="btn-destructive-outline" onClick={handleStop} disabled={rtmsLoading}>
                          <Square size={12} />
                          Stop
                        </Button>
                      </>
                    )}
                    {/* Invite participants */}
                    {(
                    <div className="invite-dropdown-container" ref={inviteDropdownRef}>
                      <Button
                        variant="outline"
                        size="sm"
                        className={inviteSent ? 'invite-sent' : ''}
                        onClick={() => setInviteMenuOpen(prev => !prev)}
                      >
                        {inviteSent ? <Check size={12} /> : <Share2 size={12} />}
                        {inviteSent ? 'Sent' : 'Invite'}
                      </Button>
                      {inviteMenuOpen && (
                        <div className="invite-dropdown">
                          <button className="invite-dropdown-item" onClick={handleInviteAll}>
                            <Users size={14} />
                            Invite all participants
                          </button>
                          <button className="invite-dropdown-item" onClick={handleInviteChoose}>
                            <Share2 size={14} />
                            Choose participants...
                          </button>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Transcript card */}
              <Card className="transcript-live-card">
                {transcriptState === 'paused' && (
                  <div className="transcript-paused-pill">
                    <span className="text-sans text-xs text-muted">Transcript paused</span>
                  </div>
                )}
                <ScrollArea.Root className="transcript-scroll-root">
                  <ScrollArea.Viewport
                    ref={transcriptRef}
                    className="transcript-viewport"
                    onScroll={handleScroll}
                  >
                    {timelineItems.map((item) => {
                      if (item.type === 'participant-event') {
                        return (
                          <div key={item._key} className="transcript-participant-event timeline-event-animate">
                            <InlineEventIcon eventType={item.eventType} />
                            <span className="transcript-event-text text-sans text-sm">
                              <InlineEventLabel eventType={item.eventType} name={item.participantName} />
                            </span>
                            <span className="transcript-event-time text-mono text-xs">
                              {formatTimestamp(item.timestamp)}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div key={item._key} className="transcript-entry">
                          <div className="transcript-entry-header">
                            <span className="transcript-timestamp text-mono text-xs text-muted">
                              {formatTimestamp(item.tStartMs)}
                            </span>
                            <span className="transcript-speaker text-sans text-sm font-medium">
                              {item.speakerLabel}
                            </span>
                          </div>
                          <p className="transcript-text text-serif text-sm">
                            {item.text}
                          </p>
                        </div>
                      );
                    })}
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
