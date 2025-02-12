import React, { useEffect, useState } from 'react';
import type { JobData } from '@job-bodyguard/types';

export const Popup: React.FC = () => {
    const [currentJob, setCurrentJob] = useState<JobData | null>(null);
    const [hasResume, setHasResume] = useState(false);

    useEffect(() => {
        // Get current job data
        chrome.runtime.sendMessage({ type: 'GET_CURRENT_JOB', payload: null, timestamp: Date.now() }, (response) => {
            if (response?.data) {
                setCurrentJob(response.data);
            }
        });

        // Check if resume is uploaded
        chrome.storage.local.get('resume', (result) => {
            setHasResume(!!result.resume);
        });
    }, []);

    const openSidePanel = () => {
        chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL', payload: null, timestamp: Date.now() });
        window.close();
    };

    const openDashboard = () => {
        chrome.tabs.create({ url: 'https://job-bodyguard.vercel.app/dashboard' });
        window.close();
    };

    const openSettings = () => {
        chrome.tabs.create({ url: 'https://job-bodyguard.vercel.app/settings' });
        window.close();
    };

    return (
        <div className="popup">
            <header className="popup-header">
                <div className="popup-logo">
                    <span className="popup-logo-icon">🛡️</span>
                    <span className="popup-logo-text">Job Bodyguard</span>
                </div>
            </header>

            <main className="popup-content">
                {currentJob ? (
                    <div className="current-job">
                        <div className="current-job-label">Current Job</div>
                        <div className="current-job-title">{currentJob.title}</div>
                        <div className="current-job-company">{currentJob.company}</div>

                        <div className="quick-stats">
                            {currentJob.jobAge !== null && (
                                <span className="stat">
                                    ⏰ {currentJob.jobAge}d ago
                                </span>
                            )}
                            {currentJob.redFlags.length > 0 && (
                                <span className="stat stat--red">
                                    🚩 {currentJob.redFlags.length}
                                </span>
                            )}
                            {currentJob.greenFlags.length > 0 && (
                                <span className="stat stat--green">
                                    ✅ {currentJob.greenFlags.length}
                                </span>
                            )}
                        </div>

                        <button onClick={openSidePanel} className="btn btn--primary btn--full">
                            🔍 Analyze This Job
                        </button>
                    </div>
                ) : (
                    <div className="no-job">
                        <div className="no-job-icon">📋</div>
                        <div className="no-job-text">
                            Open a job posting on LinkedIn or Indeed to analyze it
                        </div>
                    </div>
                )}

                {!hasResume && (
                    <div className="resume-prompt">
                        <span>📄</span>
                        <span>Upload your resume for better analysis</span>
                        <button onClick={openSettings} className="btn btn--ghost btn--small">
                            Upload
                        </button>
                    </div>
                )}
            </main>

            <footer className="popup-footer">
                <button onClick={openDashboard} className="btn btn--ghost">
                    📊 Dashboard
                </button>
                <button onClick={openSettings} className="btn btn--ghost">
                    ⚙️ Settings
                </button>
            </footer>
        </div>
    );
};
