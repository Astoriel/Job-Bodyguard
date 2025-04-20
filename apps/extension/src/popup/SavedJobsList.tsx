import React, { useEffect, useState } from 'react';

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

    const getStatusEmoji = (status: SavedJob['status']) => {
        switch (status) {
            case 'applied': return <span className="spy-icon">&#x02C0;</span>;
            case 'interview': return <span className="spy-icon">&#x066E;</span>;
            case 'offer': return <span className="spy-icon">&#x03A9;</span>;
            case 'rejected': return <span className="spy-icon">&#x0203;</span>;
            default: return <span className="spy-icon">&#x0446;</span>;
        }
    };

    if (loading) {
        return (
            <div className="saved-jobs-loading">
                Loading saved jobs...
            </div>
        );
    }

    if (jobs.length === 0) {
        return null; // Don't show section if no jobs
    }

    const displayedJobs = expanded ? jobs : jobs.slice(0, maxItems);
    const hasMore = jobs.length > maxItems;

    return (
        <div className="saved-jobs-section">
            <div className="saved-jobs-header">
                <span className="saved-jobs-title"><span className="spy-icon">&#x0446;</span> Saved Jobs ({jobs.length})</span>
            </div>

            <ul className="saved-jobs-list">
                {displayedJobs.map(job => (
                    <li
                        key={job.id}
                        className="saved-job-item"
                        onClick={() => handleOpenJob(job.url)}
                    >
                        <div className="saved-job-info">
                            <span className="saved-job-status">{getStatusEmoji(job.status)}</span>
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
                            ✕
                        </button>
                    </li>
                ))}
            </ul>

            {hasMore && (
                <button
                    className="saved-jobs-toggle"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'Show less' : `Show all ${jobs.length} jobs`}
                </button>
            )}
        </div>
    );
};
