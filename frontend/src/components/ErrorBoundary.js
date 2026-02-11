import React from 'react';
import Button from './ui/Button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '40vh',
          gap: '16px',
          padding: '16px',
          textAlign: 'center',
        }}>
          <h2 style={{ fontFamily: 'var(--font-serif)' }}>Something went wrong</h2>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
            An unexpected error occurred.
          </p>
          <Button onClick={() => {
            this.setState({ hasError: false, error: null });
            window.location.hash = '#/home';
          }}>
            Reload
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
