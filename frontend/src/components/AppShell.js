import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, Settings, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import OwlIcon from './OwlIcon';
import Button from './ui/Button';
import LiveMeetingBanner from './LiveMeetingBanner';
import './AppShell.css';

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchRef = useRef(null);

  // Show back arrow on sub-pages (not /home)
  const showBack = location.pathname !== '/home' && location.pathname !== '/';

  // Close search on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch {
        // Search failed silently
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleResultClick = (result) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/meetings/${result.meetingId}`);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          {showBack ? (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft size={16} />
            </Button>
          ) : (
            <Link to="/home" className="header-brand">
              <OwlIcon size={20} />
              <span className="text-serif font-medium">Arlo</span>
            </Link>
          )}
        </div>

        <div className="header-right" ref={searchRef}>
          {searchOpen && (
            <div className="search-container">
              <input
                type="text"
                className="input search-input"
                placeholder="Search transcripts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchResults.length > 0 && (
                <div className="search-dropdown card">
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      className="search-result"
                      onClick={() => handleResultClick(result)}
                    >
                      <span className="search-result-title text-serif">{result.meetingTitle}</span>
                      <span className="search-result-snippet text-muted text-xs">
                        {result.snippet}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button variant="ghost" size="icon" onClick={() => setSearchOpen(!searchOpen)}>
            <Search size={16} />
          </Button>

          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </Button>

          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <Settings size={16} />
          </Button>
        </div>
      </header>

      <LiveMeetingBanner />

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
