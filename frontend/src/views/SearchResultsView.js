import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Card from '../components/ui/Card';
import OwlIcon from '../components/OwlIcon';
import './SearchResultsView.css';

function highlightQuery(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index}>{part}</mark>
    ) : (
      part
    )
  );
}

export default function SearchResultsView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(query);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setSearchQuery(query);
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch {
        // Search failed silently
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="search-results-view">
      <form onSubmit={handleSubmit}>
        <div className="search-input-wrapper">
          <Search size={20} className="search-input-icon" />
          <input
            type="text"
            className="input"
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      </form>

      {query && searched && !loading && (
        <p className="search-result-count">
          {results.length} {results.length === 1 ? 'result' : 'results'} for &ldquo;{query}&rdquo;
        </p>
      )}

      {loading ? (
        <div className="search-empty">
          <p className="text-muted text-sm">Searching...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="search-results-list">
          {results.map((result, i) => (
            <Card
              key={i}
              className="search-result-card"
              onClick={() => navigate(`/meetings/${result.meetingId}`)}
            >
              <div className="search-result-inner">
                <div className="search-result-text-group">
                  <h3 className="text-serif font-medium">{result.meetingTitle}</h3>
                  <p className="text-serif text-sm search-highlight">
                    {highlightQuery(result.snippet || result.text, query)}
                  </p>
                </div>
                <div className="search-result-meta">
                  {result.speaker && <span>{result.speaker}</span>}
                  {result.speaker && <span>&bull;</span>}
                  {result.timestamp && <span>{result.timestamp}</span>}
                  {result.timestamp && <span>&bull;</span>}
                  {result.date && (
                    <span>
                      {new Date(result.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : searched && query ? (
        <div className="search-empty">
          <div className="search-empty-inner">
            <OwlIcon size={64} />
            <div>
              <p className="text-serif text-lg">No results found</p>
              <p className="text-sans text-sm text-muted">
                Try searching with different keywords or check your spelling
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="search-empty">
          <div className="search-empty-inner">
            <Search size={48} />
            <p className="text-serif text-lg text-muted">
              Search across all your meetings
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
