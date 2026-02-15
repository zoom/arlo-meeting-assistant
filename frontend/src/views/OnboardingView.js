import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OwlIcon from '../components/OwlIcon';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import './OnboardingView.css';

const nextSteps = [
  'Open Zoom on your desktop or mobile',
  'Start or join a meeting',
  'Click "Apps" in the meeting toolbar',
  'Select "Arlo" to begin capturing transcripts',
];

export default function OnboardingView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth();
  const isFirst = searchParams.get('first') === 'true';

  // OAuth callback loading state — matches Figma OAuthLoading design
  if (isLoading) {
    return (
      <div className="onboarding-view">
        <div className="onboarding-loading">
          <OwlIcon size={48} className="onboarding-owl" />
          <div className="onboarding-loading-row">
            <Loader2 size={20} className="onboarding-spinner" />
            <p className="text-sans text-muted">Connecting to Zoom...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="onboarding-view">
        <div className="onboarding-loading">
          <OwlIcon size={48} className="onboarding-owl" />
          <p className="text-sans text-muted">Session expired. Please install again.</p>
          <Button variant="default" onClick={() => navigate('/')}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-view">
      <div className="onboarding-content">
        {/* Success Icon */}
        <div className="onboarding-icon-wrapper">
          <div className="onboarding-check-circle">
            <CheckCircle2 size={40} className="onboarding-check-icon" />
          </div>
        </div>

        {/* Heading */}
        <div className="onboarding-heading">
          <h1 className="text-serif onboarding-title">
            {isFirst ? 'Welcome to Arlo!' : 'Welcome back!'}
          </h1>
          <p className="text-sans text-muted">
            {isFirst
              ? `Successfully connected to Zoom${user?.displayName ? ` as ${user.displayName}` : ''}!`
              : `Good to see you again${user?.displayName ? `, ${user.displayName}` : ''}.`}
          </p>
        </div>

        {/* Next Steps Card */}
        <Card className="onboarding-steps-card">
          <div className="onboarding-steps-inner">
            <div className="onboarding-steps-icon">
              <OwlIcon size={40} />
            </div>
            <div className="onboarding-steps-body">
              <h2 className="text-sans font-medium text-lg">Next Steps</h2>
              <ol className="onboarding-steps">
                {nextSteps.map((step, index) => (
                  <li key={index} className="text-sans text-sm onboarding-step-item">
                    <span className="font-medium onboarding-step-num">{index + 1}.</span>
                    <span className="text-muted">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="onboarding-actions">
          <Button
            variant="default"
            size="lg"
            className="onboarding-open-zoom"
            onClick={() => { window.open('https://zoom.us', '_blank'); }}
          >
            Open Zoom <ExternalLink size={16} />
          </Button>

          <p className="text-sans text-sm text-muted" style={{ textAlign: 'center' }}>
            Need help?{' '}
            <a href="https://github.com/anthropics/arlo-meeting-assistant" target="_blank" rel="noopener noreferrer">
              Visit our documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
