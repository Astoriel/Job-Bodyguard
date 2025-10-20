import React, { useEffect, useState } from 'react';
import { Bookmark, Send, Calendar, Award, XCircle, Search, Settings, FileDown, Briefcase, MapPin, Flag, CheckCircle, ShieldAlert, Trash2, HelpCircle, AlertCircle } from 'lucide-react';

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

const getStatusIcon = (status: string, size = 18) => {
    switch (status) {
        case 'applied': return <Send size={size} />;
        case 'interview': return <Calendar size={size} />;
        case 'offer': return <Award size={size} />;
        case 'rejected': return <XCircle size={size} />;
        case 'all': return <Search size={size} />;
        default: return <Bookmark size={size} />;
    }
};

const STATUS_OPTIONS = [
    { value: 'saved', icon: 'bookmark', label: 'Saved' },
    { value: 'applied', icon: 'send', label: 'Applied' },
    { value: 'interview', icon: 'calendar', label: 'Interview' },
    { value: 'offer', icon: 'award', label: 'Offer' },
    { value: 'rejected', icon: 'x-circle', label: 'Rejected' },
];

const STATUS_FILTER_OPTIONS = [{ value: 'all', icon: 'search', label: 'All' }, ...STATUS_OPTIONS];

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const Dashboard: React.FC = () => {
    const [jobs, setJobs] = useState<SavedJob[]>([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState<'jobs' | 'help'>('jobs');

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
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tab') === 'help') {
            setCurrentView('help');
        }

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
                    <Briefcase size={28} className="dash-logo-icon" />
                    <span className="dash-logo-text">Job Bodyguard</span>
                    <span className="dash-subtitle">Workspace</span>
                </div>
                <div className="dash-actions">
                    <button onClick={() => setCurrentView(currentView === 'help' ? 'jobs' : 'help')} className={`dash-btn ${currentView === 'help' ? 'dash-btn-secondary' : 'dash-btn-ghost'}`}>
                        {currentView === 'help' ? <Bookmark size={18} /> : <HelpCircle size={18} />} 
                        {currentView === 'help' ? 'Jobs' : 'Help'}
                    </button>
                    <button onClick={handleExport} className="dash-btn dash-btn-secondary">
                        <FileDown size={18} /> Export
                    </button>
                    <a href={chrome.runtime.getURL('settings.html')} className="dash-btn dash-btn-ghost">
                        <Settings size={18} /> Settings
                    </a>
                </div>
            </header>

            <div className="dash-body">
                {currentView === 'help' ? (
                    <div className="help-section" style={{maxWidth: '800px', margin: '40px auto', padding: '0 20px'}}>
                        <h1 style={{fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '16px', color: 'var(--text-main)'}}>Help & Information</h1>
                        <p style={{marginBottom: '32px', fontSize: '16px', color: 'var(--text-muted)', lineHeight: '1.6'}}>
                            Welcome to the Job Bodyguard Help Center. Here you can find information on how to use the extension, manage your targets, and get support if something goes wrong.
                        </p>

                        <div style={{background: 'var(--bg-card)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border-color)', marginBottom: '32px'}}>
                            <h2 style={{fontFamily: 'var(--font-display)', fontSize: '24px', marginBottom: '12px', color: 'var(--text-main)'}}>Have a problem or feature request?</h2>
                            <p style={{marginBottom: '24px', fontSize: '15px', color: 'var(--text-muted)', lineHeight: '1.5'}}>
                                We actively track bugs and feature requests on our GitHub repository. If you encounter any issues or have ideas to improve Job Bodyguard, please raise an issue.
                            </p>
                            <a href="https://github.com/Astoriel/Job-Bodyguard/issues" target="_blank" rel="noopener noreferrer" style={{display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '12px', background: 'var(--text-main)', color: 'var(--bg-main)', textDecoration: 'none', fontWeight: 600, fontSize: '15px', transition: 'transform 0.2s'}}>
                                <AlertCircle size={20} /> Raise Issue &rarr;
                            </a>
                        </div>
                        
                        <div style={{background: 'var(--bg-card)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border-color)'}}>
                            <h2 style={{fontFamily: 'var(--font-display)', fontSize: '20px', marginBottom: '16px', color: 'var(--text-main)'}}>FAQ</h2>
                            <div style={{marginBottom: '20px'}}>
                                <h3 style={{fontSize: '16px', fontWeight: 600, marginBottom: '8px'}}>How does the AI Analysis work?</h3>
                                <p style={{fontSize: '14px', color: 'var(--text-muted)'}}>Job Bodyguard securely sends the job description text to the configured AI provider (OpenAI by default) in your settings. It compares the job semantics against your saved resume to find skill gaps and identify toxic corporate language.</p>
                            </div>
                            <div>
                                <h3 style={{fontSize: '16px', fontWeight: 600, marginBottom: '8px'}}>Is my data tracked?</h3>
                                <p style={{fontSize: '14px', color: 'var(--text-muted)'}}>No. All your saved jobs, resumes, and settings are stored locally in your browser's extension storage. No external servers are used other than the direct AI APIs.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                <div className="stats-row">
                    {[
                        { label: 'Total Tracked', value: stats.total, key: 'all' },
                        { label: 'Applications', value: stats.applied, key: 'applied' },
                        { label: 'Interviews', value: stats.interview, key: 'interview' },
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
                            {getStatusIcon(o.value, 16)} {o.label}
                        </button>
                    ))}
                </div>

                {/* Job list */}
                {loading ? (
                    <div className="empty-state">
                        <div className="spinner" />
                        <p>Loading your targets...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><Search size={48} /></div>
                        <h3>{filter === 'all' ? 'No jobs found' : `No ${filter} jobs`}</h3>
                        <p>
                            {filter === 'all'
                                ? 'Browse jobs on LinkedIn or Indeed, select an application, and click Save!'
                                : 'Update the status of your existing saved jobs to see them here.'}
                        </p>
                    </div>
                ) : (
                    <div className="jobs-grid">
                        {filtered.map(job => (
                            <div key={job.id} className="job-card">
                                <div className="job-card-title">
                                    {job.url
                                        ? <a href={job.url} target="_blank" rel="noopener noreferrer">{job.title || 'Untitled Job'}</a>
                                        : (job.title || 'Untitled Job')}
                                </div>
                                <div className="job-card-company">{job.company}</div>
                                {job.location && <div className="job-card-location"><MapPin size={14} className="text-muted" /> {job.location}</div>}

                                <div className="job-card-flags">
                                    {(job.redFlags?.length || 0) > 0 && (
                                        <span className="badge badge-red"><Flag size={12}/> {job.redFlags!.length}</span>
                                    )}
                                    {(job.greenFlags?.length || 0) > 0 && (
                                        <span className="badge badge-green"><CheckCircle size={12}/> {job.greenFlags!.length}</span>
                                    )}
                                    {job.toxicityScore != null && (
                                        <span className={`badge ${job.toxicityScore > 60 ? 'badge-red' : job.toxicityScore > 30 ? 'badge-amber' : 'badge-green'}`}>
                                            <ShieldAlert size={12}/> {job.toxicityScore} / 100
                                        </span>
                                    )}
                                </div>

                                <div className="job-card-footer">
                                    <div className="status-select-wrapper">
                                        <label>{getStatusIcon(job.status, 16)}</label>
                                        <select
                                            className="status-select"
                                            value={job.status}
                                            onChange={e => handleStatusChange(job.id, e.target.value as SavedJob['status'])}
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
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                    </>
                )}
            </div>
        </div>
    );
};
