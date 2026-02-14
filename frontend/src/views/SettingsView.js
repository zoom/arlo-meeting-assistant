import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import './SettingsView.css';

// TODO: Persist settings via API when backend endpoints are available

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

export default function SettingsView() {
  const [autoOpen, setAutoOpen] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const [provider, setProvider] = useState('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [model, setModel] = useState('anthropic/claude-3.5-sonnet');
  const [testStatus, setTestStatus] = useState('idle'); // idle | testing | success | error

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

            <hr className="settings-separator" />

            <div className="settings-toggle-row">
              <div className="settings-toggle-text">
                <label className="text-sans font-medium" htmlFor="auto-start">
                  Auto-start transcription
                </label>
                <p className="text-sans text-sm text-muted">
                  Begin capturing transcript as soon as you join
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
    </div>
  );
}
