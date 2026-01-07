import React, { useState, useEffect } from 'react';
import './HighlightsPanel.css';

function HighlightsPanel({ meetingId }) {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newHighlight, setNewHighlight] = useState({ title: '', notes: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (meetingId) {
      fetchHighlights();
    }
  }, [meetingId]);

  const fetchHighlights = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/highlights?meetingId=${meetingId}`, {
        credentials: 'include', // Include cookies for authentication
      });
      const data = await response.json();
      setHighlights(data.highlights || []);
    } catch (err) {
      console.error('Failed to fetch highlights:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newHighlight.title.trim()) return;

    setError(null);
    try {
      const response = await fetch('/api/highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          meetingId,
          title: newHighlight.title,
          notes: newHighlight.notes || null,
          tStartMs: 0,
          tEndMs: 0,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create highlight');
      }

      const data = await response.json();
      setHighlights([...highlights, data.highlight]);
      setNewHighlight({ title: '', notes: '' });
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/highlights/${id}`, {
        method: 'DELETE',
        credentials: 'include', // Include cookies for authentication
      });

      if (response.ok) {
        setHighlights(highlights.filter(h => h.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete highlight:', err);
    }
  };

  return (
    <div className="highlights-panel">
      <div className="highlights-header">
        <h3>Highlights & Bookmarks</h3>
        <button
          className="add-highlight-btn"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add Highlight'}
        </button>
      </div>

      {error && (
        <div className="highlight-error">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="highlight-form">
          <input
            type="text"
            value={newHighlight.title}
            onChange={(e) => setNewHighlight({ ...newHighlight, title: e.target.value })}
            placeholder="Highlight title..."
            required
          />
          <textarea
            value={newHighlight.notes}
            onChange={(e) => setNewHighlight({ ...newHighlight, notes: e.target.value })}
            placeholder="Notes (optional)..."
            rows={2}
          />
          <button type="submit">Save Highlight</button>
        </form>
      )}

      {loading ? (
        <div className="highlights-loading">
          <div className="loading-spinner"></div>
          <span>Loading highlights...</span>
        </div>
      ) : highlights.length === 0 ? (
        <div className="no-highlights">
          No highlights yet. Add one to bookmark important moments!
        </div>
      ) : (
        <ul className="highlights-list">
          {highlights.map((highlight) => (
            <li key={highlight.id} className="highlight-item">
              <div className="highlight-content">
                <span className="highlight-title">{highlight.title}</span>
                {highlight.notes && (
                  <p className="highlight-notes">{highlight.notes}</p>
                )}
                <span className="highlight-time">
                  {new Date(highlight.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                className="delete-highlight-btn"
                onClick={() => handleDelete(highlight.id)}
                title="Delete highlight"
              >
                x
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default HighlightsPanel;
