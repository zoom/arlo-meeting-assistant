import React from 'react';
import './RTMSControls.css';

function RTMSControls({ rtmsActive, rtmsLoading, onStart, onStop }) {
  return (
    <div className="rtms-controls">
      {!rtmsActive ? (
        <button
          className="start-button"
          onClick={onStart}
          disabled={rtmsLoading}
        >
          {rtmsLoading ? (
            <>
              <span className="button-spinner"></span>
              Starting...
            </>
          ) : (
            '🎙️ Start Arlo'
          )}
        </button>
      ) : (
        <div className="rtms-status">
          <div className="status-indicator">
            <span className="pulse"></span>
            <span>Recording Transcript</span>
          </div>
          <button
            className="stop-button"
            onClick={onStop}
            disabled={rtmsLoading}
          >
            {rtmsLoading ? (
              <>
                <span className="button-spinner"></span>
                Stopping...
              </>
            ) : (
              '⏹️ Stop'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default RTMSControls;
