import React from 'react';
import Card from '../components/ui/Card';
import './SettingsView.css';

export default function SettingsView() {
  return (
    <div className="settings-view">
      <div className="settings-cards">
        <Card className="settings-card settings-disabled">
          <div className="settings-card-inner">
            <h3 className="text-serif font-medium">Preferences</h3>
            <p className="text-muted text-sm">Coming soon</p>
          </div>
        </Card>

        <Card className="settings-card settings-disabled">
          <div className="settings-card-inner">
            <h3 className="text-serif font-medium">Account</h3>
            <p className="text-muted text-sm">Coming soon</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
