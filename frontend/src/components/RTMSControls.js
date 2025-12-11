import React from 'react';
import './RTMSControls.css';

function RTMSControls({ rtmsActive, onStart, onStop }) {
  return (
    <div className="rtms-controls">
      {!rtmsActive ? (
        <button className="start-button" onClick={onStart}>
          🎙️ Start Meeting Assistant
        </button>
      ) : (
        <div className="rtms-status">
          <div className="status-indicator">
            <span className="pulse"></span>
            <span>Recording Transcript</span>
          </div>
          <button className="stop-button" onClick={onStop}>
            ⏹️ Stop
          </button>
        </div>
      )}
    </div>
  );
}

export default RTMSControls;
