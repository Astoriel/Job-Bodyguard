import React, { useEffect, useState } from 'react';
import type { JobData, AnalysisResult } from '@job-bodyguard/types';
import { AnalysisPanel } from './AnalysisPanel';

type ViewState = 'loading' | 'no-job' | 'ready' | 'analyzing' | 'results';

export const SidePanel: React.FC = () => {
    const [viewState, setViewState] = useState<ViewState>('loading');
    const [jobData, setJobData] = useState<JobData | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Get current job data from background
        chrome.storage.local.get('currentJob', (result) => {
            if (result.currentJob) {
                setJobData(result.currentJob);
                setViewState('ready');
            } else {
                setViewState('no-job');
            }
        });

        // Listen for job data updates
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.currentJob?.newValue) {
                setJobData(changes.currentJob.newValue);
                setViewState('ready');
                setAnalysisResult(null);
            }
        });
    }, []);

    const handleAnalyze = async () => {
        if (!jobData) return;

        setViewState('analyzing');
        setError(null);

        try {
            const response = await new Promise<{ success: boolean; data?: AnalysisResult; error?: string }>((resolve) => {
                chrome.runtime.sendMessage(
                    { type: 'REQUEST_ANALYSIS', payload: jobData, timestamp: Date.now() },
                    resolve
                );
            });

            if (response.success && response.data) {
                setAnalysisResult(response.data);
                setViewState('results');
            } else {
                setError(response.error || 'Analysis failed');
                setViewState('ready');
            }
        } catch (err) {
            setError('Failed to analyze job');
            setViewState('ready');
        }
    };

    const handleTailor = () => {
        // TODO: Implement resume tailoring
        console.log('Tailor resume');
    };

    const handleSave = () => {
        // TODO: Implement save application
        console.log('Save application');
    };

    return (
        <div className="sidepanel">
            <header className="sidepanel-header">
                <div className="logo">
                    <span className="logo-icon">🛡️</span>
                    <span className="logo-text">Job Bodyguard</span>
                </div>
            </header>

            <main className="sidepanel-content">
                {viewState === 'loading' && (
                    <div className="state state--loading">
                        <div className="spinner" />
                        <p>Loading...</p>
                    </div>
                )}

                {viewState === 'no-job' && (
                    <div className="state state--empty">
                        <div className="state-icon">📋</div>
                        <h2>No Job Selected</h2>
                        <p>Open a job posting on LinkedIn or Indeed to analyze it.</p>
                    </div>
                )}

                {viewState === 'ready' && jobData && (
                    <div className="job-preview">
                        <div className="job-preview-header">
                            <h2 className="job-title">{jobData.title}</h2>
                            <p className="job-company">{jobData.company}</p>
                            {jobData.location && <p className="job-location">📍 {jobData.location}</p>}
                        </div>

                        {/* Quick Flags Preview */}
                        <div className="flags-preview">
                            {jobData.redFlags.length > 0 && (
                                <div className="flag-group flag-group--red">
                                    <h3>🚩 Red Flags ({jobData.redFlags.length})</h3>
                                    <ul>
                                        {jobData.redFlags.slice(0, 3).map((flag, i) => (
                                            <li key={i}>{flag.keyword}</li>
                                        ))}
                                        {jobData.redFlags.length > 3 && (
                                            <li className="more">+{jobData.redFlags.length - 3} more...</li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            {jobData.greenFlags.length > 0 && (
                                <div className="flag-group flag-group--green">
                                    <h3>✅ Green Flags ({jobData.greenFlags.length})</h3>
                                    <ul>
                                        {jobData.greenFlags.slice(0, 3).map((flag, i) => (
                                            <li key={i}>{flag.keyword}</li>
                                        ))}
                                        {jobData.greenFlags.length > 3 && (
                                            <li className="more">+{jobData.greenFlags.length - 3} more...</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="error-message">
                                ⚠️ {error}
                            </div>
                        )}

                        <button onClick={handleAnalyze} className="btn btn--primary btn--full">
                            🤖 Analyze with AI
                        </button>
                    </div>
                )}

                {viewState === 'analyzing' && (
                    <div className="state state--analyzing">
                        <div className="spinner" />
                        <h2>Analyzing Job Posting...</h2>
                        <p>Our AI is decoding the corporate speak</p>
                    </div>
                )}

                {viewState === 'results' && analysisResult && jobData && (
                    <AnalysisPanel
                        jobData={jobData}
                        result={analysisResult}
                        onTailor={handleTailor}
                        onSave={handleSave}
                        onReanalyze={handleAnalyze}
                    />
                )}
            </main>
        </div>
    );
};
