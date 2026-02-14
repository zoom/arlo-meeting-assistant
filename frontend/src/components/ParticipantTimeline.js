import React from 'react';
import Card from './ui/Card';
import './ParticipantTimeline.css';

const BAR_COLORS = ['timeline-bar-blue', 'timeline-bar-purple', 'timeline-bar-green', 'timeline-bar-orange', 'timeline-bar-pink'];

export default function ParticipantTimeline({ participants, meetingDuration }) {
  // Check if we have meaningful timeline data
  const hasTimelineData = participants && participants.length > 0 && participants.some(p => p.duration || p.joinedAt || p.leftAt);

  if (!hasTimelineData) {
    return (
      <Card>
        <div className="timeline-empty">
          <p className="text-serif text-muted">
            Timeline data will be available in a future update.
          </p>
        </div>
      </Card>
    );
  }

  // Generate 15-minute tick marks
  const tickMarks = [];
  for (let i = 0; i <= meetingDuration; i += 15) {
    tickMarks.push(i);
  }

  return (
    <Card>
      <div className="timeline-card">
        <div className="timeline-inner">
          {/* Time axis */}
          <div className="timeline-axis">
            <div className="timeline-axis-label" />
            <div className="timeline-axis-ticks">
              {tickMarks.map((mark) => (
                <div key={mark}>{mark}m</div>
              ))}
            </div>
          </div>

          {/* Participant swimlanes */}
          <div className="timeline-swimlanes">
            {participants.map((participant, idx) => {
              const color = BAR_COLORS[idx % BAR_COLORS.length];
              const duration = participant.duration || meetingDuration;
              const widthPercent = (duration / meetingDuration) * 100;
              const name = participant.displayName || participant.name || participant.label || 'Unknown';

              return (
                <div key={participant.id || idx} className="timeline-swimlane">
                  <div className="timeline-swimlane-name">{name}</div>
                  <div className="timeline-swimlane-track">
                    <div className="timeline-swimlane-bg" />
                    <div
                      className={`timeline-swimlane-bar ${color}`}
                      style={{ width: `${Math.min(widthPercent, 100)}%` }}
                      title={`${name}: ${duration} minutes`}
                    >
                      <span className="timeline-duration">{duration}m</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
