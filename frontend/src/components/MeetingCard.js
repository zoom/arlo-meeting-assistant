import React from 'react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import './MeetingCard.css';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDuration(ms) {
  if (!ms) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

export default function MeetingCard({ meeting, onClick }) {
  const isLive = meeting.status === 'ongoing';
  const speakers = meeting.speakers || [];
  const participantNames = speakers
    .map((s) => s.displayName || s.label)
    .filter(Boolean)
    .slice(0, 4);

  const duration = meeting.duration
    ? formatDuration(meeting.duration)
    : meeting.endTime && meeting.startTime
      ? formatDuration(new Date(meeting.endTime) - new Date(meeting.startTime))
      : null;

  return (
    <Card className="meeting-card" onClick={onClick}>
      <div className="meeting-card-inner">
        <div className="meeting-card-body">
          <div className="meeting-card-header">
            <h3 className="text-serif font-medium meeting-card-title">{meeting.title}</h3>
            {isLive && <Badge variant="accent">Live</Badge>}
          </div>
          <div className="meeting-card-meta text-sans text-sm text-muted">
            <span>{formatDate(meeting.startTime)}</span>
            {duration && <><span className="meta-dot">&middot;</span><span>{duration}</span></>}
          </div>
          {participantNames.length > 0 && (
            <p className="meeting-card-participants text-sans text-xs text-muted">
              {participantNames.join(', ')}
              {speakers.length > 4 && ` +${speakers.length - 4}`}
            </p>
          )}
        </div>
        <Button variant={isLive ? 'accent' : 'outline'} size="sm">
          {isLive ? 'Join' : 'View'}
        </Button>
      </div>
    </Card>
  );
}
