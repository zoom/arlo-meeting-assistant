import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import './NotFoundView.css';

export default function NotFoundView() {
  const navigate = useNavigate();

  return (
    <div className="not-found-view">
      <h1 className="not-found-heading text-serif">404</h1>
      <p className="text-muted">Page not found</p>
      <Button onClick={() => navigate('/home')}>Go to Home</Button>
    </div>
  );
}
