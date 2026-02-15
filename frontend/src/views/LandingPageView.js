import React from 'react';
import { Mic, Sparkles, Search, Zap, Shield, Users, ExternalLink } from 'lucide-react';
import OwlIcon from '../components/OwlIcon';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import './LandingPageView.css';

const features = [
  {
    icon: Mic,
    title: 'Live Transcription',
    description: "Real-time transcript capture using Zoom's native RTMS — no bot joining your meeting.",
  },
  {
    icon: Sparkles,
    title: 'AI Summaries',
    description: 'Instant meeting summaries with key points, decisions, and action items.',
  },
  {
    icon: Search,
    title: 'Searchable History',
    description: 'Full-text search across all your meetings. Never lose important context.',
  },
  {
    icon: Zap,
    title: 'Instant Access',
    description: 'Runs natively inside Zoom — no external app or browser tab needed.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Your data stays encrypted. Full compliance with Zoom security standards.',
  },
  {
    icon: Users,
    title: 'Team Ready',
    description: 'Works for 1-on-1s, team meetings, and large calls. Scales with your needs.',
  },
];

const steps = [
  { number: 1, title: 'Install from Marketplace', description: 'Add Arlo to your Zoom account' },
  { number: 2, title: 'Start a Meeting', description: 'Open Arlo in any Zoom meeting' },
  { number: 3, title: 'Get AI Insights', description: 'Automatic transcripts and summaries' },
];

export default function LandingPageView() {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <OwlIcon size={80} className="landing-owl" />

        <div className="landing-hero-text">
          <h1 className="text-serif landing-hero-title">
            Your AI Meeting Assistant, Built for Zoom
          </h1>
          <p className="text-sans text-muted landing-hero-subtitle">
            Capture transcripts, generate summaries, and track action items in real-time — no meeting bot required.
          </p>
        </div>

        <div className="landing-hero-actions">
          <Button variant="default" size="lg" onClick={() => { window.location.href = '/api/auth/start'; }}>
            Install from Marketplace <ExternalLink size={16} />
          </Button>
          <Button variant="outline" size="lg" onClick={() => {
            document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
          }}>
            Learn More
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="landing-section">
        <h2 className="text-serif landing-section-title">Everything you need</h2>
        <div className="landing-features-grid">
          {features.map((feature) => (
            <Card key={feature.title} className="landing-feature-card">
              <div className="landing-feature-inner">
                <div className="landing-feature-icon-circle">
                  <feature.icon size={20} />
                </div>
                <h3 className="text-sans font-medium">{feature.title}</h3>
                <p className="text-sans text-sm text-muted" style={{ lineHeight: 1.625 }}>
                  {feature.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="landing-section">
        <h2 className="text-serif landing-section-title">How it works</h2>
        <div className="landing-steps-grid">
          {steps.map((step, index) => (
            <div key={step.number} className="landing-step">
              <div className="landing-step-circle">
                <span className="text-serif">{step.number}</span>
              </div>
              {index < steps.length - 1 && (
                <div className="landing-step-arrow" />
              )}
              <div className="landing-step-text">
                <h3 className="text-sans font-medium">{step.title}</h3>
                <p className="text-sans text-sm text-muted">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="landing-section landing-bottom-cta">
        <h2 className="text-serif landing-cta-title">Ready to get started?</h2>
        <Button variant="default" size="lg" onClick={() => { window.location.href = '/api/auth/start'; }}>
          Install Now <ExternalLink size={16} />
        </Button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p className="text-sans text-sm text-muted">
          Arlo Meeting Assistant &copy; 2026 &middot; Open Source
        </p>
      </footer>
    </div>
  );
}
