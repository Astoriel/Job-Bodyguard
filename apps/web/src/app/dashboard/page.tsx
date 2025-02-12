'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function DashboardPage(): JSX.Element {
  const [user, setUser] = useState<{ email: string } | null>(null);

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="nav-content">
          <Link href="/" className="logo">
            <span className="logo-icon">🛡️</span>
            <span className="logo-text">Job Bodyguard</span>
          </Link>
          <div className="nav-links">
            <Link href="/dashboard" className="nav-link active">Applications</Link>
            <Link href="/dashboard/settings" className="nav-link">Settings</Link>
          </div>
        </div>
      </nav>

      <main className="dashboard-content">
        <div className="dashboard-header">
          <h1>Your Applications</h1>
          <p className="text-muted">Track all your job applications in one place</p>
        </div>

        <div className="applications-section">
          <div className="stats-grid">
            <div className="stat-card card">
              <div className="stat-value">0</div>
              <div className="stat-label">Total Applications</div>
            </div>
            <div className="stat-card card">
              <div className="stat-value text-warning">0</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-card card">
              <div className="stat-value text-success">0</div>
              <div className="stat-label">Interviews</div>
            </div>
            <div className="stat-card card">
              <div className="stat-value text-danger">0</div>
              <div className="stat-label">Rejected</div>
            </div>
          </div>

          <div className="applications-table card">
            <div className="table-header">
              <h3>Recent Applications</h3>
            </div>
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No applications yet</h3>
              <p className="text-muted">
                Install the Chrome extension and start analyzing job postings
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
