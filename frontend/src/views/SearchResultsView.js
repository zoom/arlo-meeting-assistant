import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, FileText, Sparkles } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
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

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(ms) {
  if (!ms) return null;
  const totalSeconds = Math.floor(Number(ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function SearchResultsView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(query);
  const [titleResults, setTitleResults] = useState([]);
  const [summaryResults, setSummaryResults] = useState([]);
  const [transcriptResults, setTranscriptResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setSearchQuery(query);
    if (!query.trim()) {
      setTitleResults([]);
      setSummaryResults([]);
      setTranscriptResults([]);
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
          setTitleResults(data.titleResults || []);
          setSummaryResults(data.summaryResults || []);
          setTranscriptResults(data.transcriptResults || []);
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

  const totalCount = titleResults.length + summaryResults.length + transcriptResults.length;
  const hasResults = totalCount > 0;
  const hasMultipleSections = [titleResults, summaryResults, transcriptResults].filter(a => a.length > 0).length > 1;

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
          {totalCount} {totalCount === 1 ? 'result' : 'results'} for &ldquo;{query}&rdquo;
        </p>
      )}

      {loading ? (
        <div className="search-empty">
          <p className="text-muted text-sm">Searching...</p>
        </div>
      ) : hasResults ? (
        <div className="search-results-list">
          {titleResults.length > 0 && (
            <>
              {hasMultipleSections && (
                <div className="search-section-label">
                  <FileText size={14} />
                  <span>Meetings</span>
                </div>
              )}
              {titleResults.map((result, i) => (
                <Card
                  key={`title-${i}`}
                  className="search-result-card"
                  onClick={() => navigate(`/meetings/${result.meetingId}`)}
                >
                  <div className="search-result-inner">
                    <div className="search-result-text-group">
                      <h3 className="text-serif font-medium search-highlight">
                        {highlightQuery(result.meetingTitle, query)}
                      </h3>
                    </div>
                    <div className="search-result-meta">
                      <span>{result.segmentCount} segments</span>
                      <span>&bull;</span>
                      <span>{formatDate(result.meetingDate)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}

          {summaryResults.length > 0 && (
            <>
              {hasMultipleSections && (
                <div className="search-section-label">
                  <Sparkles size={14} />
                  <span>In Summaries</span>
                </div>
              )}
              {summaryResults.map((result, i) => (
                <Card
                  key={`summary-${i}`}
                  className="search-result-card"
                  onClick={() => navigate(`/meetings/${result.meetingId}`)}
                >
                  <div className="search-result-inner">
                    <div className="search-result-text-group">
                      <h3 className="text-serif font-medium">{result.meetingTitle}</h3>
                      <p className="text-serif text-sm search-highlight">
                        {highlightQuery(result.snippet, query)}
                      </p>
                    </div>
                    <div className="search-result-meta">
                      {result.matchField && (
                        <>
                          <Badge variant="secondary">{result.matchField}</Badge>
                          <span>&bull;</span>
                        </>
                      )}
                      <span>{formatDate(result.meetingDate)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}

          {transcriptResults.length > 0 && (
            <>
              {hasMultipleSections && (
                <div className="search-section-label">
                  <Search size={14} />
                  <span>In Transcripts</span>
                </div>
              )}
              {transcriptResults.map((result, i) => (
                <Card
                  key={`transcript-${i}`}
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
                      {formatTimestamp(result.tStartMs) && (
                        <>
                          <span>{formatTimestamp(result.tStartMs)}</span>
                          <span>&bull;</span>
                        </>
                      )}
                      <span>{formatDate(result.meetingDate)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
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
