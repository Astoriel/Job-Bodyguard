'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface SavedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  savedAt: string;
  status: 'saved' | 'applied' | 'interview' | 'rejected' | 'offer';
  platform: string;
  redFlags: { keyword: string }[];
  greenFlags: { keyword: string }[];
  hiddenSalary?: { min: number | null; max: number | null; currency: string };
}

const STATUS_OPTIONS = [
  { value: 'saved', label: '💾 Saved', color: '#888' },
  { value: 'applied', label: '📨 Applied', color: '#3498db' },
  { value: 'interview', label: '🎯 Interview', color: '#f39c12' },
  { value: 'offer', label: '🎉 Offer', color: '#27ae60' },
  { value: 'rejected', label: '❌ Rejected', color: '#e74c3c' },
];

export default function DashboardPage(): JSX.Element {
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadJobs();

    // Listen for updates from extension
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'JOBS_UPDATED') {
        setJobs(event.data.payload || []);
      }
    };

    window.addEventListener('message', handleMessage);

    // Poll for updates every 5 seconds
    const interval = setInterval(loadJobs, 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(interval);
    };
  }, []);

  const loadJobs = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/jobs');
      const data = await response.json();

      if (data.success && data.data) {
        setJobs(data.data);
      }
    } catch (e) {
      console.error('Failed to load jobs from API:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await fetch(`http://localhost:3000/api/jobs?id=${jobId}`, {
        method: 'DELETE',
      });

      const updated = jobs.filter(j => j.id !== jobId);
      setJobs(updated);
    } catch (e) {
      console.error('Failed to delete job:', e);
    }
  };

  const handleStatusChange = async (jobId: string, newStatus: SavedJob['status']) => {
    const updated = jobs.map(j =>
      j.id === jobId ? { ...j, status: newStatus } : j
    );
    setJobs(updated);

    try {
      await fetch('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.error('Failed to update job status:', e);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatSalary = (job: SavedJob) => {
    if (!job.hiddenSalary) return null;
    const { min, max, currency } = job.hiddenSalary;
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
    if (min && max) return `${symbol}${(min / 1000).toFixed(0)}k - ${symbol}${(max / 1000).toFixed(0)}k`;
    if (min) return `${symbol}${(min / 1000).toFixed(0)}k+`;
    if (max) return `Up to ${symbol}${(max / 1000).toFixed(0)}k`;
    return null;
  };

  const filteredJobs = filter === 'all'
    ? jobs
    : jobs.filter(j => j.status === filter);

  const stats = {
    total: jobs.length,
    applied: jobs.filter(j => j.status === 'applied').length,
    interview: jobs.filter(j => j.status === 'interview').length,
    rejected: jobs.filter(j => j.status === 'rejected').length,
    offer: jobs.filter(j => j.status === 'offer').length,
  };

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
            <Link href="/settings" className="nav-link">Settings</Link>
          </div>
        </div>
      </nav>

      <main className="dashboard-content">
        <div className="dashboard-header">
          <h1>Your Applications</h1>
          <p className="text-muted">Track all your job applications in one place</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card card" onClick={() => setFilter('all')}>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Saved</div>
          </div>
          <div className="stat-card card" onClick={() => setFilter('applied')}>
            <div className="stat-value text-info">{stats.applied}</div>
            <div className="stat-label">Applied</div>
          </div>
          <div className="stat-card card" onClick={() => setFilter('interview')}>
            <div className="stat-value text-warning">{stats.interview}</div>
            <div className="stat-label">Interviews</div>
          </div>
          <div className="stat-card card" onClick={() => setFilter('offer')}>
            <div className="stat-value text-success">{stats.offer}</div>
            <div className="stat-label">Offers</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          {['all', ...STATUS_OPTIONS.map(s => s.value)].map(status => (
            <button
              key={status}
              className={`filter-tab ${filter === status ? 'active' : ''}`}
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'All' : STATUS_OPTIONS.find(s => s.value === status)?.label}
            </button>
          ))}
        </div>

        {/* Jobs List */}
        <div className="jobs-section card">
          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>{filter === 'all' ? 'No saved jobs yet' : `No ${filter} jobs`}</h3>
              <p className="text-muted">
                {filter === 'all'
                  ? 'Install the Chrome extension and start saving job postings'
                  : 'Change the status of your saved jobs to see them here'}
              </p>
            </div>
          ) : (
            <div className="jobs-grid">
              {filteredJobs.map(job => (
                <div key={job.id} className="job-card">
                  <div className="job-card-header">
                    <div className="job-card-title">
                      <a href={job.url} target="_blank" rel="noopener noreferrer">
                        {job.title}
                      </a>
                    </div>
                    <button
                      className="job-card-delete"
                      onClick={() => handleDelete(job.id)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="job-card-company">{job.company}</div>
                  {job.location && <div className="job-card-location">📍 {job.location}</div>}

                  <div className="job-card-meta">
                    {formatSalary(job) && (
                      <span className="job-salary">💰 {formatSalary(job)}</span>
                    )}
                    <span className="job-date">📅 {formatDate(job.savedAt)}</span>
                  </div>

                  {/* Flags Summary */}
                  <div className="job-card-flags">
                    {job.redFlags?.length > 0 && (
                      <span className="flag-badge flag-red">🚩 {job.redFlags.length}</span>
                    )}
                    {job.greenFlags?.length > 0 && (
                      <span className="flag-badge flag-green">✅ {job.greenFlags.length}</span>
                    )}
                  </div>

                  {/* Status Selector */}
                  <div className="job-card-status">
                    <select
                      value={job.status}
                      onChange={(e) => handleStatusChange(job.id, e.target.value as SavedJob['status'])}
                      style={{ borderColor: STATUS_OPTIONS.find(s => s.value === job.status)?.color }}
                    >
                      {STATUS_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 2rem;
        }
        
        .stat-card {
          cursor: pointer;
          text-align: center;
          padding: 1.5rem;
          transition: all 0.2s ease;
        }
        
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        
        .stat-value {
          font-size: 2rem;
          font-weight: bold;
          color: var(--text-primary);
        }
        
        .stat-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }
        
        .filter-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }
        
        .filter-tab {
          padding: 0.5rem 1rem;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          border-radius: 20px;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }
        
        .filter-tab:hover {
          border-color: var(--accent-primary);
        }
        
        .filter-tab.active {
          background: var(--accent-primary);
          color: #000;
          border-color: var(--accent-primary);
        }
        
        .jobs-section {
          padding: 1.5rem;
        }
        
        .jobs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }
        
        .job-card {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 1rem;
          transition: all 0.2s ease;
        }
        
        .job-card:hover {
          border-color: var(--accent-primary);
        }
        
        .job-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }
        
        .job-card-title {
          font-weight: 600;
          font-size: 1rem;
        }
        
        .job-card-title a {
          color: var(--text-primary);
          text-decoration: none;
        }
        
        .job-card-title a:hover {
          color: var(--accent-primary);
        }
        
        .job-card-delete {
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
        }
        
        .job-card-delete:hover {
          opacity: 1;
        }
        
        .job-card-company {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }
        
        .job-card-location {
          color: var(--text-secondary);
          font-size: 0.75rem;
          margin-bottom: 0.5rem;
        }
        
        .job-card-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }
        
        .job-salary {
          color: #27ae60;
        }
        
        .job-card-flags {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        
        .flag-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
        }
        
        .flag-red {
          background: rgba(231, 76, 60, 0.2);
          color: #e74c3c;
        }
        
        .flag-green {
          background: rgba(39, 174, 96, 0.2);
          color: #27ae60;
        }
        
        .job-card-status select {
          width: 100%;
          padding: 0.5rem;
          border-radius: 4px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 2px solid var(--border-color);
          cursor: pointer;
        }
        
        .empty-state {
          text-align: center;
          padding: 3rem;
        }
        
        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        
        .loading-state {
          text-align: center;
          padding: 2rem;
          color: var(--text-secondary);
        }
        
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
