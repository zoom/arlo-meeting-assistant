import React from 'react';
import { Mic, Sparkles, Search } from 'lucide-react';
import OwlIcon from '../components/OwlIcon';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import useZoomAuth from '../hooks/useZoomAuth';
import './GuestNoMeetingView.css';

export default function GuestNoMeetingView() {
  const { authorize } = useZoomAuth();

  return (
    <div className="guest-no-meeting">
      <div className="guest-content">
        <OwlIcon size={64} />

        <div className="guest-heading">
          <h1 className="text-serif text-2xl">
            Meet Arlo, your AI meeting assistant
          </h1>
        </div>

        <div className="guest-features">
          <Card>
            <div className="guest-feature-inner">
              <Mic size={20} className="guest-feature-icon" />
              <div className="guest-feature-text">
                <h3 className="text-sans font-medium">Live Transcription</h3>
                <p className="text-sans text-sm text-muted">
                  Capture every word without a meeting bot
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="guest-feature-inner">
              <Sparkles size={20} className="guest-feature-icon" />
              <div className="guest-feature-text">
                <h3 className="text-sans font-medium">AI Summaries</h3>
                <p className="text-sans text-sm text-muted">
                  Get key points, action items, and insights
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="guest-feature-inner">
              <Search size={20} className="guest-feature-icon" />
              <div className="guest-feature-text">
                <h3 className="text-sans font-medium">Searchable History</h3>
                <p className="text-sans text-sm text-muted">
                  Find anything across all your meetings
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Button size="lg" className="guest-btn" onClick={() => authorize()}>
          Connect with Zoom
        </Button>
      </div>
    </div>
  );
}
