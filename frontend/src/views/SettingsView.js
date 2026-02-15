import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, XCircle, MessageSquare, ExternalLink } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import './SettingsView.css';

const MODELS = {
  openrouter: [
    { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'openai/gpt-4', label: 'GPT-4' },
    { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  ],
  openai: [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  custom: [
    { value: 'custom-model', label: 'Custom Model' },
  ],
};

const DEFAULT_MESSAGES = {
  start: "I'm using a Zoom app, Arlo, to transcribe this meeting and generate a summary.",
  pause: 'Transcription paused.',
  resume: 'Transcription resumed.',
  stop: 'Transcription stopped. Transcript will be available shortly.',
  restart: 'Transcription restarted.',
};

const DEFAULT_EVENTS = {
  start: true,
  pause: true,
  resume: true,
  stop: false,
  restart: false,
};

const MOCK_SETTINGS_UPCOMING = [
  { id: 'u1', title: 'Weekly Product Sync', date: '2026-02-17T10:00:00Z', duration: 30, autoOpenEnabled: true },
  { id: 'u2', title: 'Q1 Planning Review', date: '2026-02-17T14:00:00Z', duration: 60, autoOpenEnabled: false },
  { id: 'u3', title: 'Engineering Standup', date: '2026-02-18T09:00:00Z', duration: 15, autoOpenEnabled: false },
];

export default function SettingsView() {
  const navigate = useNavigate();
  const [autoOpen, setAutoOpen] = useState(true);
  const [autoStart, setAutoStart] = useState(true);
  const [settingsUpcoming, setSettingsUpcoming] = useState([]);
  const [provider, setProvider] = useState('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet');
  const [testStatus, setTestStatus] = useState('idle');

  // Chat notifications state
  const [chatNotificationsEnabled, setChatNotificationsEnabled] = useState(true);
  const [notifyOnStart, setNotifyOnStart] = useState(true);
  const [notifyOnPause, setNotifyOnPause] = useState(true);
  const [notifyOnResume, setNotifyOnResume] = useState(true);
  const [notifyOnStop, setNotifyOnStop] = useState(false);
  const [notifyOnRestart, setNotifyOnRestart] = useState(false);
  const [startMessage, setStartMessage] = useState(DEFAULT_MESSAGES.start);
  const [pauseMessage, setPauseMessage] = useState(DEFAULT_MESSAGES.pause);
  const [resumeMessage, setResumeMessage] = useState(DEFAULT_MESSAGES.resume);
  const [stopMessage, setStopMessage] = useState(DEFAULT_MESSAGES.stop);
  const [restartMessage, setRestartMessage] = useState(DEFAULT_MESSAGES.restart);

  const saveTimerRef = useRef(null);
  const autoStartMountedRef = useRef(false);

  // Build chatNotices object from state
  const buildChatNotices = useCallback(() => ({
    enabled: chatNotificationsEnabled,
    events: {
      start: notifyOnStart,
      pause: notifyOnPause,
      resume: notifyOnResume,
      stop: notifyOnStop,
      restart: notifyOnRestart,
    },
    messages: {
      start: startMessage,
      pause: pauseMessage,
      resume: resumeMessage,
      stop: stopMessage,
      restart: restartMessage,
    },
  }), [chatNotificationsEnabled, notifyOnStart, notifyOnPause, notifyOnResume, notifyOnStop, notifyOnRestart, startMessage, pauseMessage, resumeMessage, stopMessage, restartMessage]);

  // Load preferences on mount
  useEffect(() => {
    // Try localStorage first for instant load
    try {
      const cached = localStorage.getItem('arlo-chat-notices');
      if (cached) {
        const notices = JSON.parse(cached);
        applyNoticesState(notices);
      }
      const cachedAutoStart = localStorage.getItem('arlo-auto-start');
      if (cachedAutoStart !== null) {
        setAutoStart(JSON.parse(cachedAutoStart));
      }
    } catch {}

    // Then fetch from API
    fetch('/api/preferences', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(prefs => {
        if (prefs?.chatNotices) {
          applyNoticesState(prefs.chatNotices);
          localStorage.setItem('arlo-chat-notices', JSON.stringify(prefs.chatNotices));
        }
        if (prefs?.autoStartRTMS !== undefined) {
          setAutoStart(prefs.autoStartRTMS);
          localStorage.setItem('arlo-auto-start', JSON.stringify(prefs.autoStartRTMS));
        }
      })
      .catch(() => {});
  }, []);

  function applyNoticesState(notices) {
    if (notices.enabled !== undefined) setChatNotificationsEnabled(notices.enabled);
    if (notices.events) {
      if (notices.events.start !== undefined) setNotifyOnStart(notices.events.start);
      if (notices.events.pause !== undefined) setNotifyOnPause(notices.events.pause);
      if (notices.events.resume !== undefined) setNotifyOnResume(notices.events.resume);
      if (notices.events.stop !== undefined) setNotifyOnStop(notices.events.stop);
      if (notices.events.restart !== undefined) setNotifyOnRestart(notices.events.restart);
    }
    if (notices.messages) {
      if (notices.messages.start !== undefined) setStartMessage(notices.messages.start);
      if (notices.messages.pause !== undefined) setPauseMessage(notices.messages.pause);
      if (notices.messages.resume !== undefined) setResumeMessage(notices.messages.resume);
      if (notices.messages.stop !== undefined) setStopMessage(notices.messages.stop);
      if (notices.messages.restart !== undefined) setRestartMessage(notices.messages.restart);
    }
  }

  // Save chat notices on change (debounced to API, immediate to localStorage)
  useEffect(() => {
    const chatNotices = buildChatNotices();
    localStorage.setItem('arlo-chat-notices', JSON.stringify(chatNotices));

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chatNotices }),
      }).catch(() => {});
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [buildChatNotices]);

  // Save auto-start preference on change (skip initial mount)
  useEffect(() => {
    if (!autoStartMountedRef.current) {
      autoStartMountedRef.current = true;
      return;
    }
    localStorage.setItem('arlo-auto-start', JSON.stringify(autoStart));
    fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ autoStartRTMS: autoStart }),
    }).catch(() => {});
  }, [autoStart]);

  // Fetch upcoming meetings for auto-open section
  useEffect(() => {
    if (!autoOpen) return;
    fetch('/api/zoom-meetings', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.meetings) {
          setSettingsUpcoming(data.meetings.slice(0, 3));
        } else {
          setSettingsUpcoming(MOCK_SETTINGS_UPCOMING);
        }
      })
      .catch(() => setSettingsUpcoming(MOCK_SETTINGS_UPCOMING));
  }, [autoOpen]);

  const toggleSettingsUpcoming = async (meetingId) => {
    const meeting = settingsUpcoming.find((m) => m.id === meetingId);
    if (!meeting) return;
    const wasEnabled = meeting.autoOpenEnabled;
    setSettingsUpcoming((prev) =>
      prev.map((m) => (m.id === meetingId ? { ...m, autoOpenEnabled: !m.autoOpenEnabled } : m))
    );
    try {
      await fetch(`/api/zoom-meetings/${meetingId}/auto-open`, {
        method: wasEnabled ? 'DELETE' : 'POST',
        credentials: 'include',
      });
    } catch {
      // keep optimistic state
    }
  };

  const formatSettingsDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    const firstModel = MODELS[newProvider]?.[0]?.value || '';
    setModel(firstModel);
  };

  const handleTestConnection = () => {
    setTestStatus('testing');
    // TODO: Replace with actual API test call
    setTimeout(() => {
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    }, 1500);
  };

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h1 className="text-serif text-2xl">Settings</h1>
        <p className="text-sans text-sm text-muted">
          Configure Arlo&apos;s behavior and AI provider
        </p>
      </div>

      {/* Transcription Preferences */}
      <section className="settings-section">
        <h2 className="text-serif text-xl">Transcription Preferences</h2>
        <Card>
          <div className="settings-card-inner">
            <div className="settings-toggle-row">
              <div className="settings-toggle-text">
                <label className="text-sans font-medium" htmlFor="auto-open">
                  Auto-open in meetings
                </label>
                <p className="text-sans text-sm text-muted">
                  Automatically open Arlo when your Zoom meetings start
                </p>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  id="auto-open"
                  checked={autoOpen}
                  onChange={(e) => setAutoOpen(e.target.checked)}
                />
                <span className="settings-toggle-track" />
                <span className="settings-toggle-thumb" />
              </label>
            </div>

            {autoOpen && (
              <div className="settings-auto-open-expand">
                <p className="text-sans text-sm text-muted">
                  Arlo will automatically open when your meetings start. You can choose which meetings below.
                </p>

                <div className="settings-upcoming-list">
                  {settingsUpcoming.map((meeting) => (
                    <div key={meeting.id} className="settings-upcoming-row">
                      <div className="settings-upcoming-info">
                        <p className="text-sans text-sm font-medium">{meeting.title}</p>
                        <p className="text-sans text-xs text-muted">
                          {formatSettingsDate(meeting.date)}
                        </p>
                      </div>
                      <label className="settings-toggle settings-toggle-sm">
                        <input
                          type="checkbox"
                          checked={meeting.autoOpenEnabled}
                          onChange={() => toggleSettingsUpcoming(meeting.id)}
                        />
                        <span className="settings-toggle-track" />
                        <span className="settings-toggle-thumb" />
                      </label>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/upcoming')}
                  className="text-sans settings-manage-link"
                >
                  Manage all meetings →
                </button>
              </div>
            )}

            <hr className="settings-separator" />

            <div className="settings-toggle-row">
              <div className="settings-toggle-text">
                <label className="text-sans font-medium" htmlFor="auto-start">
                  Start transcription when you open this app
                </label>
                <p className="text-sans text-sm text-muted">
                  Transcription begins as soon as you open Arlo in a meeting.
                  If you&apos;re not the host, Arlo will request the host to allow transcription.
                </p>
                <p className="text-sans text-xs text-muted" style={{ marginTop: 4 }}>
                  With auto-open enabled, transcription starts as soon as you join.
                </p>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  id="auto-start"
                  checked={autoStart}
                  onChange={(e) => setAutoStart(e.target.checked)}
                />
                <span className="settings-toggle-track" />
                <span className="settings-toggle-thumb" />
              </label>
            </div>
          </div>
        </Card>
      </section>

      {/* AI Configuration */}
      <section className="settings-section">
        <h2 className="text-serif text-xl">AI Configuration</h2>
        <Card>
          <div className="settings-card-inner">
            <div className="settings-field">
              <label className="text-sans font-medium" htmlFor="provider">
                AI Provider
              </label>
              <select
                id="provider"
                className="settings-select"
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                <option value="openrouter">OpenRouter</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="custom">Custom</option>
              </select>
              <p className="settings-field-help">
                Choose your preferred AI provider for meeting summaries and insights
              </p>
            </div>

            {provider !== 'openrouter' && (
              <div className="settings-field">
                <label className="text-sans font-medium" htmlFor="api-key">
                  API Key
                </label>
                <div className="settings-api-key-wrapper">
                  <Input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                  <button
                    type="button"
                    className="settings-api-key-toggle"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="settings-field-help">
                  Your API key is stored locally and never sent to Arlo&apos;s servers
                </p>
              </div>
            )}

            <div className="settings-field">
              <label className="text-sans font-medium" htmlFor="model">
                Model
              </label>
              <select
                id="model"
                className="settings-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {(MODELS[provider] || []).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="settings-field-help">
                Select the AI model to use for processing meeting data
              </p>
            </div>

            <div className="settings-test-row">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </Button>
              {testStatus === 'success' && (
                <span className="settings-test-success">
                  <CheckCircle2 size={16} />
                  Connection successful
                </span>
              )}
              {testStatus === 'error' && (
                <span className="settings-test-error">
                  <XCircle size={16} />
                  Connection failed
                </span>
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* Chat Notifications */}
      <section className="settings-section">
        <h2 className="text-serif text-xl">Chat Notifications</h2>
        <Card>
          <div className="settings-card-inner">
            {/* Master Toggle */}
            <div className="settings-toggle-row">
              <div className="settings-toggle-text">
                <label className="text-sans font-medium" htmlFor="chat-notifications">
                  Enable Chat Notifications
                </label>
                <p className="text-sans text-sm text-muted">
                  Send automatic Zoom chat messages when transcription events occur
                </p>
              </div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  id="chat-notifications"
                  checked={chatNotificationsEnabled}
                  onChange={(e) => setChatNotificationsEnabled(e.target.checked)}
                />
                <span className="settings-toggle-track" />
                <span className="settings-toggle-thumb" />
              </label>
            </div>

            {chatNotificationsEnabled && (
              <>
                {/* Event Toggles */}
                <hr className="settings-separator" />
                <div className="settings-event-toggles">
                  <p className="text-sans text-sm font-medium">
                    Notify when transcription:
                  </p>
                  <div className="settings-event-list">
                    <div className="settings-event-row">
                      <label className="text-sans" htmlFor="notify-on-start">Starts</label>
                      <label className="settings-toggle">
                        <input type="checkbox" id="notify-on-start" checked={notifyOnStart} onChange={(e) => setNotifyOnStart(e.target.checked)} />
                        <span className="settings-toggle-track" />
                        <span className="settings-toggle-thumb" />
                      </label>
                    </div>
                    <div className="settings-event-row">
                      <label className="text-sans" htmlFor="notify-on-pause">Pauses</label>
                      <label className="settings-toggle">
                        <input type="checkbox" id="notify-on-pause" checked={notifyOnPause} onChange={(e) => setNotifyOnPause(e.target.checked)} />
                        <span className="settings-toggle-track" />
                        <span className="settings-toggle-thumb" />
                      </label>
                    </div>
                    <div className="settings-event-row">
                      <label className="text-sans" htmlFor="notify-on-resume">Resumes</label>
                      <label className="settings-toggle">
                        <input type="checkbox" id="notify-on-resume" checked={notifyOnResume} onChange={(e) => setNotifyOnResume(e.target.checked)} />
                        <span className="settings-toggle-track" />
                        <span className="settings-toggle-thumb" />
                      </label>
                    </div>
                    <div className="settings-event-row">
                      <label className="text-sans" htmlFor="notify-on-stop">Stops</label>
                      <label className="settings-toggle">
                        <input type="checkbox" id="notify-on-stop" checked={notifyOnStop} onChange={(e) => setNotifyOnStop(e.target.checked)} />
                        <span className="settings-toggle-track" />
                        <span className="settings-toggle-thumb" />
                      </label>
                    </div>
                    <div className="settings-event-row">
                      <label className="text-sans" htmlFor="notify-on-restart">Restarts</label>
                      <label className="settings-toggle">
                        <input type="checkbox" id="notify-on-restart" checked={notifyOnRestart} onChange={(e) => setNotifyOnRestart(e.target.checked)} />
                        <span className="settings-toggle-track" />
                        <span className="settings-toggle-thumb" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Message Templates */}
                <hr className="settings-separator" />
                <div className="settings-message-templates">
                  <div className="settings-template-header">
                    <MessageSquare size={16} className="settings-template-icon" />
                    <div>
                      <p className="text-sans text-sm font-medium">Message Templates</p>
                      <p className="text-sans text-xs text-muted">
                        Customize messages for each event. Use <code className="settings-code-inline">[meeting-id]</code> as a placeholder for the actual meeting ID.
                      </p>
                    </div>
                  </div>

                  {notifyOnStart && (
                    <div className="settings-field">
                      <label className="text-sans font-medium" htmlFor="start-message">
                        Start Message
                      </label>
                      <Textarea
                        id="start-message"
                        value={startMessage}
                        onChange={(e) => setStartMessage(e.target.value)}
                        placeholder="Transcription started..."
                        rows={3}
                      />
                      <div className="settings-template-hint">
                        <ExternalLink size={12} />
                        <p className="text-sans text-xs text-muted">
                          Include links to live transcripts or your privacy policy
                        </p>
                      </div>
                    </div>
                  )}

                  {notifyOnPause && (
                    <div className="settings-field">
                      <label className="text-sans font-medium" htmlFor="pause-message">
                        Pause Message
                      </label>
                      <Textarea
                        id="pause-message"
                        value={pauseMessage}
                        onChange={(e) => setPauseMessage(e.target.value)}
                        placeholder="Transcription paused."
                        rows={2}
                      />
                    </div>
                  )}

                  {notifyOnResume && (
                    <div className="settings-field">
                      <label className="text-sans font-medium" htmlFor="resume-message">
                        Resume Message
                      </label>
                      <Textarea
                        id="resume-message"
                        value={resumeMessage}
                        onChange={(e) => setResumeMessage(e.target.value)}
                        placeholder="Transcription resumed."
                        rows={2}
                      />
                    </div>
                  )}

                  {notifyOnStop && (
                    <div className="settings-field">
                      <label className="text-sans font-medium" htmlFor="stop-message">
                        Stop Message
                      </label>
                      <Textarea
                        id="stop-message"
                        value={stopMessage}
                        onChange={(e) => setStopMessage(e.target.value)}
                        placeholder="Transcription stopped. Transcript will be available shortly."
                        rows={2}
                      />
                    </div>
                  )}

                  {notifyOnRestart && (
                    <div className="settings-field">
                      <label className="text-sans font-medium" htmlFor="restart-message">
                        Restart Message
                      </label>
                      <Textarea
                        id="restart-message"
                        value={restartMessage}
                        onChange={(e) => setRestartMessage(e.target.value)}
                        placeholder="Transcription restarted."
                        rows={2}
                      />
                    </div>
                  )}
                </div>

                {/* Preview */}
                {notifyOnStart && (
                  <>
                    <hr className="settings-separator" />
                    <div className="settings-preview-section">
                      <p className="text-sans text-sm font-medium">Preview</p>
                      <div className="settings-preview">
                        <div className="settings-preview-bubble">
                          <MessageSquare size={16} className="settings-preview-icon" />
                          <div className="settings-preview-content">
                            <p className="text-sans text-xs font-medium">Your name</p>
                            <p className="text-sans text-xs settings-preview-text">
                              {startMessage.replace(/\[meeting-id\]/g, 'abc-123-xyz')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sans text-xs text-muted">
                        This is how your start message will appear in Zoom chat
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
