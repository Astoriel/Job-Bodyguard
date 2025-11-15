import React, { useEffect, useState } from 'react';
import { Bookmark, Send, Calendar, XCircle, Award, X } from 'lucide-react';

interface SavedJob {
    id: string;
    title: string;
    company: string;
    url: string;
    savedAt: string;
    status: 'saved' | 'applied' | 'interview' | 'rejected' | 'offer';
}

interface SavedJobsListProps {
    maxItems?: number;
}

export const SavedJobsList: React.FC<SavedJobsListProps> = ({ maxItems = 5 }) => {
    const [jobs, setJobs] = useState<SavedJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        loadJobs();

        // Listen for storage changes
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.savedJobs) {
                setJobs(changes.savedJobs.newValue || []);
            }
        };

        chrome.storage.sync.onChanged.addListener(listener);
        chrome.storage.local.onChanged.addListener(listener);

        return () => {
            chrome.storage.sync.onChanged.removeListener(listener);
            chrome.storage.local.onChanged.removeListener(listener);
        };
    }, []);

    const loadJobs = async () => {
        try {
            const response = await new Promise<{ success: boolean; data?: SavedJob[] }>((resolve) => {
                chrome.runtime.sendMessage(
                    { type: 'GET_SAVED_JOBS', payload: null, timestamp: Date.now() },
                    resolve
                );
            });

            if (response.success && response.data) {
                setJobs(response.data);
            }
        } catch (err) {
            console.error('Failed to load saved jobs:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (jobId: string, e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            await new Promise<{ success: boolean }>((resolve) => {
                chrome.runtime.sendMessage(
                    { type: 'DELETE_JOB', payload: jobId, timestamp: Date.now() },
                    resolve
                );
            });

            setJobs(prev => prev.filter(j => j.id !== jobId));
        } catch (err) {
            console.error('Failed to delete job:', err);
        }
    };

    const handleOpenJob = (url: string) => {
        chrome.tabs.create({ url });
        window.close();
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getStatusIcon = (status: SavedJob['status']) => {
        switch (status) {
            case 'applied': return <Send size={18} style={{color: '#3b82f6'}} />;
            case 'interview': return <Calendar size={18} style={{color: '#a855f7'}} />;
            case 'offer': return <Award size={18} style={{color: '#22c55e'}} />;
            case 'rejected': return <XCircle size={18} style={{color: '#ef4444'}} />;
            default: return <Bookmark size={18} style={{color: '#f97316'}} />;
        }
    };

    if (loading) {
        return (
            <div className="saved-jobs-loading">
                <div className="spinner" style={{display: 'inline-block', marginRight: '8px', width: '12px', height: '12px'}}/>
                <span>Loading saved jobs...</span>
            </div>
        );
    }

    if (jobs.length === 0) {
        return null;
    }

    const displayedJobs = expanded ? jobs : jobs.slice(0, maxItems);
    const hasMore = jobs.length > maxItems;

    return (
        <div className="saved-jobs-section">
            <div className="saved-jobs-header">
                <span className="saved-jobs-title">Saved Jobs ({jobs.length})</span>
            </div>

            <ul className="saved-jobs-list">
                {displayedJobs.map(job => (
                    <li
                        key={job.id}
                        className="saved-job-item"
                        onClick={() => handleOpenJob(job.url)}
                    >
                        <div className="saved-job-info">
                            <span className="saved-job-status">{getStatusIcon(job.status)}</span>
                            <div className="saved-job-details">
                                <div className="saved-job-title">{job.title}</div>
                                <div className="saved-job-meta">
                                    {job.company} • {formatDate(job.savedAt)}
                                </div>
                            </div>
                        </div>
                        <button
                            className="saved-job-delete"
                            onClick={(e) => handleDelete(job.id, e)}
                            title="Remove"
                        >
                            <X size={16} />
                        </button>
                    </li>
                ))}
            </ul>

            {hasMore && (
                <button
                    className="saved-jobs-toggle"
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: 'transparent',
                        border: '1px dashed var(--border-color)',
                        borderRadius: '12px',
                        marginTop: '12px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)'
                    }}
                >
                    {expanded ? 'Show less' : `Show all ${jobs.length} jobs`}
                </button>
            )}
        </div>
    );
};
