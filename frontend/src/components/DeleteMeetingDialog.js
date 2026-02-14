import React from 'react';
import Button from './ui/Button';
import './DeleteMeetingDialog.css';

export default function DeleteMeetingDialog({ open, onOpenChange, meetingTitle, onConfirm }) {
  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  return (
    <div className="delete-dialog-overlay" onClick={handleOverlayClick}>
      <div className="delete-dialog-content" role="alertdialog" aria-labelledby="delete-dialog-title">
        <div className="delete-dialog-header">
          <h2 id="delete-dialog-title" className="text-serif text-lg font-medium">
            Delete this meeting?
          </h2>
          <p className="text-sans text-sm text-muted">
            This will permanently remove the meeting, transcript, and all highlights. This cannot be undone.
          </p>
        </div>
        <div className="delete-dialog-footer">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <button className="btn-destructive" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
