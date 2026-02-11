import React from 'react';
import OwlIcon from '../components/OwlIcon';
import Button from '../components/ui/Button';
import './GuestNoMeetingView.css';

export default function GuestNoMeetingView() {
  return (
    <div className="guest-no-meeting">
      <div className="guest-content">
        <OwlIcon size={64} />

        <div className="guest-text text-serif">
          <h1 className="text-2xl">Arlo helps you capture meeting context with AI</h1>
          <p className="text-muted">
            Get real-time transcription, smart summaries, and action item tracking for your Zoom meetings.
          </p>
        </div>

        <Button size="lg" className="guest-btn">
          Install Arlo
        </Button>
      </div>
    </div>
  );
}
