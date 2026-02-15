import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OwlIcon from '../components/OwlIcon';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import './OnboardingView.css';

export default function OnboardingView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth();
  const isFirst = searchParams.get('first') === 'true';

  if (isLoading) {
    return (
      <div className="onboarding-view">
        <div className="onboarding-content">
          <OwlIcon size={48} className="onboarding-owl" />
          <LoadingSpinner size={32} />
          <p className="text-muted">Connecting to Zoom...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="onboarding-view">
        <div className="onboarding-content">
          <OwlIcon size={48} className="onboarding-owl" />
          <p className="text-muted">Session expired. Please install again.</p>
          <Button variant="accent" onClick={() => navigate('/')}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-view">
      <div className="onboarding-content">
        <CheckCircle size={64} className="onboarding-check" />

        <div className="onboarding-heading">
          <h1 className="text-serif text-2xl">
            {isFirst ? 'Welcome to Arlo!' : 'Welcome back!'}
          </h1>
          <p className="text-muted">
            {isFirst
              ? `Successfully connected to Zoom${user?.displayName ? ` as ${user.displayName}` : ''}.`
              : `Good to see you again${user?.displayName ? `, ${user.displayName}` : ''}.`}
          </p>
        </div>

        <Card className="onboarding-steps-card">
          <div className="onboarding-steps-inner">
            <div className="onboarding-steps-icon">
              <OwlIcon size={32} />
            </div>
            <div className="onboarding-steps-list">
              <h3 className="text-sans font-medium">Next Steps</h3>
              <ol className="onboarding-steps">
                <li>Open Zoom on your desktop or mobile</li>
                <li>Start or join a meeting</li>
                <li>Click <strong>Apps</strong> in the meeting toolbar</li>
                <li>Select <strong>Arlo</strong> to begin capturing transcripts</li>
              </ol>
            </div>
          </div>
        </Card>

        <Button
          variant="accent"
          size="lg"
          className="onboarding-open-zoom"
          onClick={() => {
            window.open('zoommtg://zoom.us/start', '_blank');
          }}
        >
          Open Zoom <ExternalLink size={16} />
        </Button>

        <p className="text-xs text-muted">
          Need help? Visit our{' '}
          <a href="https://github.com/anthropics/arlo-meeting-assistant" target="_blank" rel="noopener noreferrer">
            documentation
          </a>
        </p>
      </div>
    </div>
  );
}
