import React, { useEffect, useState } from 'react';
import type { JobData, AnalysisResult } from '@job-bodyguard/types';
import { AnalysisPanel } from './AnalysisPanel';

type ViewState = 'loading' | 'no-job' | 'ready' | 'analyzing' | 'results';

export const SidePanel: React.FC = () => {
    const [viewState, setViewState] = useState<ViewState>('loading');
    const [jobData, setJobData] = useState<JobData | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    useEffect(() => {
        // Get current job data from storage
        chrome.storage.local.get('currentJob', (result) => {
            if (result.currentJob) {
                setJobData(result.currentJob);
                setViewState('ready');
            } else {
                setViewState('no-job');
            }
        });

        // Listen for job data updates (new page detected by content script)
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.currentJob?.newValue) {
                setJobData(changes.currentJob.newValue);
                setViewState('ready');
                setAnalysisResult(null);
                setError(null);
                setSaveStatus('idle');
            }
        };

        chrome.storage.local.onChanged.addListener(listener);
        return () => chrome.storage.local.onChanged.removeListener(listener);
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
                // Show the error clearly — don't silently swallow it
                const msg = response.error || 'Analysis failed';
                setError(msg);
                setViewState('ready');
            }
        } catch (err) {
            setError('Failed to connect to background service. Try reloading the extension.');
            setViewState('ready');
        }
    };

    const handleSave = async () => {
        if (!jobData) return;

        setSaveStatus('saving');

        try {
            const payload = analysisResult
                ? {
                    ...jobData,
                    toxicityScore: analysisResult.toxicityScore,
                    compatibilityScore: analysisResult.compatibilityScore,
                    analysisRedFlags: analysisResult.redFlags,
                    analysisGreenFlags: analysisResult.greenFlags,
                    verdict: analysisResult.verdict,
                }
                : jobData;

            const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
                chrome.runtime.sendMessage(
                    { type: 'SAVE_TO_DASHBOARD', payload, timestamp: Date.now() },
                    resolve
                );
            });

            if (response.success) {
                setSaveStatus('saved');
                // Reset after 3 seconds
                setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
                setSaveStatus('error');
                setError(response.error || 'Failed to save');
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
        } catch (err) {
            setSaveStatus('error');
            setError('Failed to save job');
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };

    const handleTailor = () => {
        // Open the standalone app for full tailoring experience
        chrome.tabs.create({
            url: chrome.runtime.getURL('dashboard.html')
        });
    };

    const handleOpenSettings = () => {
        chrome.tabs.create({
            url: chrome.runtime.getURL('settings.html')
        });
    };

    const getSaveButtonContent = () => {
        switch (saveStatus) {
            case 'saving': return '⏳ Saving...';
            case 'saved': return '✅ Saved!';
            case 'error': return <><span className="spy-icon">&#x0203;</span> Failed</>;
            default: return <><span className="spy-icon">&#x0446;</span> Save Job</>;
        }
    };

    return (
        <div className="sidepanel">
            <header className="sidepanel-header">
                <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="spy-icon logo-icon">&#x0669;</span>
                    <span className="logo-text">Job Bodyguard</span>
                </div>
                <button
                    className="btn--icon"
                    onClick={handleOpenSettings}
                    title="Settings"
                >
                    <span className="spy-icon">&#x054D;</span>
                </button>
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
                        <div className="state-icon"><span className="spy-icon">&#x0232;</span></div>
                        <h2>No Job Detected</h2>
                        <p>Open a job posting on LinkedIn, Indeed, or HH.ru to analyze it.</p>
                    </div>
                )}

                {(viewState === 'ready' || viewState === 'results') && jobData && (
                    <div className="job-preview">
                        <div className="job-preview-header">
                            <h2 className="job-title">{jobData.title}</h2>
                            <p className="job-company">{jobData.company}</p>
                            {jobData.location && <p className="job-location"><span className="spy-icon" style={{ color: 'var(--spy-red)' }}>&#x0268;</span> {jobData.location}</p>}
                        </div>

                        {/* Quick Flags Preview */}
                        {(jobData.redFlags.length > 0 || jobData.greenFlags.length > 0) && (
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
                        )}

                        {error && (
                            <div className="error-message">
                                ⚠️ {error}
                                {error.includes('API key') && (
                                    <button
                                        className="error-action-btn"
                                        onClick={handleOpenSettings}
                                    >
                                        Open Settings →
                                    </button>
                                )}
                            </div>
                        )}

                        {viewState === 'ready' && (
                            <button onClick={handleAnalyze} className="btn btn--primary btn--full">
                                <span className="spy-icon">&#x05EE;</span> Analyze with AI
                            </button>
                        )}

                        {viewState === 'results' && analysisResult && (
                            <AnalysisPanel
                                jobData={jobData}
                                result={analysisResult}
                                onTailor={handleTailor}
                                onSave={handleSave}
                                onReanalyze={handleAnalyze}
                                saveStatus={saveStatus}
                                saveButtonContent={getSaveButtonContent()}
                            />
                        )}
                    </div>
                )}

                {viewState === 'analyzing' && (
                    <div className="state state--analyzing">
                        <div className="spinner" />
                        <h2>Analyzing Job Posting...</h2>
                        <p>AI is decoding the corporate speak</p>
                    </div>
                )}
            </main>
        </div>
    );
};
