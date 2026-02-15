import React from 'react';
import { Mic, Sparkles, Search, Zap, Shield, Users } from 'lucide-react';
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
  { number: '1', title: 'Install from Marketplace', description: 'Add Arlo to your Zoom account in one click.' },
  { number: '2', title: 'Start a Meeting', description: 'Open Arlo from the Apps menu in any Zoom meeting.' },
  { number: '3', title: 'Get AI Insights', description: 'Transcripts, summaries, and action items — automatically.' },
];

export default function LandingPageView() {
  return (
    <div className="landing-page">
      {/* Hero */}
      <section className="landing-hero">
        <OwlIcon size={80} className="landing-owl" />
        <h1 className="text-serif text-3xl landing-title">
          Your AI Meeting Assistant,{' '}
          <span className="text-accent">Built for Zoom</span>
        </h1>
        <p className="text-muted landing-subtitle">
          Capture transcripts, generate summaries, and track action items in real-time — no meeting bot required.
        </p>
        <div className="landing-hero-actions">
          <Button variant="accent" size="lg" onClick={() => { window.location.href = '/api/auth/start'; }}>
            Install from Marketplace
          </Button>
          <Button variant="outline" size="lg" onClick={() => {
            document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
          }}>
            Learn More
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-section">
        <h2 className="text-serif text-2xl landing-section-title">Everything you need</h2>
        <div className="landing-features-grid">
          {features.map((feature) => (
            <Card key={feature.title} className="landing-feature-card">
              <div className="landing-feature-inner">
                <feature.icon size={24} className="landing-feature-icon" />
                <h3 className="text-sans font-medium">{feature.title}</h3>
                <p className="text-sm text-muted">{feature.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section">
        <h2 className="text-serif text-2xl landing-section-title">How it works</h2>
        <div className="landing-steps">
          {steps.map((step) => (
            <div key={step.number} className="landing-step">
              <div className="landing-step-number text-sans font-semibold">{step.number}</div>
              <div className="landing-step-text">
                <h3 className="text-sans font-medium">{step.title}</h3>
                <p className="text-sm text-muted">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="landing-section landing-bottom-cta">
        <h2 className="text-serif text-2xl">Ready to get started?</h2>
        <Button variant="accent" size="lg" onClick={() => { window.location.href = '/api/auth/start'; }}>
          Install Now
        </Button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p className="text-xs text-muted">
          Arlo Meeting Assistant &copy; {new Date().getFullYear()} &middot; Open Source
        </p>
      </footer>
    </div>
  );
}
