import React, { useEffect, useState } from 'react';

interface SavedJob {
    id: string;
    title: string;
    company: string;
    location?: string;
    url?: string;
    savedAt: string;
    status: 'saved' | 'applied' | 'interview' | 'rejected' | 'offer';
    redFlags?: { keyword: string }[];
    greenFlags?: { keyword: string }[];
    toxicityScore?: number | null;
}

const STATUS_OPTIONS = [
    { value: 'saved', icon: '\u0446', label: 'Saved' },
    { value: 'applied', icon: '\u02C0', label: 'Applied' },
    { value: 'interview', icon: '\u066E', label: 'Interview' },
    { value: 'offer', icon: '\u03A9', label: 'Offer' },
    { value: 'rejected', icon: '\u0203', label: 'Rejected' },
];

const STATUS_FILTER_OPTIONS = [{ value: 'all', icon: '\u0232', label: 'All' }, ...STATUS_OPTIONS];

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const Dashboard: React.FC = () => {
    const [jobs, setJobs] = useState<SavedJob[]>([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    const loadJobs = () => {
        chrome.runtime.sendMessage(
            { type: 'GET_SAVED_JOBS', payload: null, timestamp: Date.now() },
            (response) => {
                if (response?.success) {
                    setJobs(response.data || []);
                }
                setLoading(false);
            }
        );
    };

    useEffect(() => {
        loadJobs();

        // Auto-refresh when storage changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.savedJobs) {
                setJobs(changes.savedJobs.newValue || []);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    const handleStatusChange = (jobId: string, newStatus: SavedJob['status']) => {
        // Update locally immediately
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));

        // Persist via background
        chrome.runtime.sendMessage(
            { type: 'GET_SAVED_JOBS', payload: null, timestamp: Date.now() },
            (response) => {
                if (response?.success) {
                    const updated = (response.data as SavedJob[]).map(j =>
                        j.id === jobId ? { ...j, status: newStatus } : j
                    );
                    chrome.storage.sync.set({ savedJobs: updated });
                }
            }
        );
    };

    const handleDelete = (jobId: string) => {
        if (!confirm('Remove this job?')) return;
        chrome.runtime.sendMessage(
            { type: 'DELETE_JOB', payload: jobId, timestamp: Date.now() },
            (response) => {
                if (response?.success) {
                    setJobs(prev => prev.filter(j => j.id !== jobId));
                }
            }
        );
    };

    const handleExport = () => {
        const blob = new Blob([JSON.stringify(jobs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `job-bodyguard-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

    const stats = {
        total: jobs.length,
        applied: jobs.filter(j => j.status === 'applied').length,
        interview: jobs.filter(j => j.status === 'interview').length,
        offer: jobs.filter(j => j.status === 'offer').length,
    };

    return (
        <div className="dashboard">
            <header className="dash-header">
                <div className="dash-logo">
                    <span className="spy-icon">&#x0669;</span>
                    <span className="dash-logo-text">Job Bodyguard</span>
                    <span className="dash-subtitle">Saved Jobs</span>
                </div>
                <div className="dash-actions">
                    <button onClick={handleExport} className="dash-btn dash-btn-secondary">
                        <span className="spy-icon">&#x00FB;</span> Export JSON
                    </button>
                    <a href={chrome.runtime.getURL('settings.html')} className="dash-btn dash-btn-ghost">
                        <span className="spy-icon">&#x054D;</span> Settings
                    </a>
                </div>
            </header>

            <div className="dash-body">
                {/* Stats */}
                <div className="stats-row">
                    {[
                        { label: 'Total', value: stats.total, key: 'all' },
                        { label: 'Applied', value: stats.applied, key: 'applied' },
                        { label: 'Interview', value: stats.interview, key: 'interview' },
                        { label: 'Offers', value: stats.offer, key: 'offer' },
                    ].map(s => (
                        <button
                            key={s.key}
                            className={`stat-card ${filter === s.key ? 'active' : ''}`}
                            onClick={() => setFilter(s.key)}
                        >
                            <div className="stat-value">{s.value}</div>
                            <div className="stat-label">{s.label}</div>
                        </button>
                    ))}
                </div>

                {/* Filter chips */}
                <div className="filter-bar">
                    {STATUS_FILTER_OPTIONS.map(o => (
                        <button
                            key={o.value}
                            className={`filter-chip ${filter === o.value ? 'active' : ''}`}
                            onClick={() => setFilter(o.value)}
                        >
                            <span className="spy-icon">{o.icon}</span> {o.label}
                        </button>
                    ))}
                </div>

                {/* Job list */}
                {loading ? (
                    <div className="empty-state">
                        <div className="spinner" />
                        <p>Loading...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><span className="spy-icon">&#x02AE;</span></div>
                        <h3>{filter === 'all' ? 'No saved jobs yet' : `No ${filter} jobs`}</h3>
                        <p>
                            {filter === 'all'
                                ? 'Browse a job on LinkedIn or Indeed — the banner will appear, click Save!'
                                : 'Change the status of your jobs to see them here.'}
                        </p>
                    </div>
                ) : (
                    <div className="jobs-grid">
                        {filtered.map(job => (
                            <div key={job.id} className="job-card">
                                <div className="job-card-title">
                                    {job.url
                                        ? <a href={job.url} target="_blank" rel="noopener">{job.title || 'Untitled Job'}</a>
                                        : (job.title || 'Untitled Job')}
                                </div>
                                <div className="job-card-company">{job.company}</div>
                                {job.location && <div className="job-card-location"><span className="spy-icon" style={{ color: 'var(--spy-red)' }}>&#x0268;</span> {job.location}</div>}

                                <div className="job-card-flags">
                                    {(job.redFlags?.length || 0) > 0 && (
                                        <span className="badge badge-red">🚩 {job.redFlags!.length}</span>
                                    )}
                                    {(job.greenFlags?.length || 0) > 0 && (
                                        <span className="badge badge-green">✅ {job.greenFlags!.length}</span>
                                    )}
                                    {job.toxicityScore != null && (
                                        <span className={`badge ${job.toxicityScore > 60 ? 'badge-red' : job.toxicityScore > 30 ? 'badge-amber' : 'badge-green'}`}>
                                            ☠️ {job.toxicityScore}
                                        </span>
                                    )}
                                </div>

                                <div className="job-card-footer">
                                    <div className="status-select-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <span className="spy-icon" style={{ position: 'absolute', left: '10px', pointerEvents: 'none', color: 'var(--spy-text-light)' }}>
                                            {STATUS_OPTIONS.find(o => o.value === job.status)?.icon || '\u0446'}
                                        </span>
                                        <select
                                            className="status-select"
                                            value={job.status}
                                            onChange={e => handleStatusChange(job.id, e.target.value as SavedJob['status'])}
                                            style={{ paddingLeft: '32px', fontFamily: 'var(--font-body)', fontWeight: 'bold' }}
                                        >
                                            {STATUS_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="job-card-actions">
                                        <span className="job-date">{formatDate(job.savedAt)}</span>
                                        <button
                                            className="delete-btn"
                                            onClick={() => handleDelete(job.id)}
                                            title="Delete"
                                        >
                                            <span className="spy-icon">&#x00EC;</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
