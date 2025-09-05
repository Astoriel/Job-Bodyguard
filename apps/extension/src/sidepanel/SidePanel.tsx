import React, { useEffect, useState } from 'react';
import type { JobData, AnalysisResult } from '@job-bodyguard/types';
import { AnalysisPanel } from './AnalysisPanel';
import { Briefcase, Settings as SettingsIcon, SearchX, CheckCircle, Bookmark, AlertTriangle, ScanSearch, MapPin, Flag, Zap } from 'lucide-react';

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
            case 'saved': return <><CheckCircle size={18} /> Saved!</>;
            case 'error': return <><AlertTriangle size={18} /> Failed</>;
            default: return <><Bookmark size={18} /> Save Target</>;
        }
    };

    return (
        <div className="sidepanel">
            <header className="sidepanel-header">
                <div className="logo">
                    <Briefcase size={28} className="logo-icon" />
                    <span className="logo-text">Job Bodyguard</span>
                </div>
                <button
                    className="btn--icon"
                    onClick={handleOpenSettings}
                    title="Settings"
                >
                    <SettingsIcon size={20} />
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
                        <SearchX size={48} className="state-icon" />
                        <h2>No Job Detected</h2>
                        <p>Open a job posting on LinkedIn, Indeed, or HH.ru to analyze it.</p>
                    </div>
                )}

                {(viewState === 'ready' || viewState === 'results') && jobData && (
                    <div className="job-preview">
                        <div className="job-preview-header">
                            <h2 className="job-title">{jobData.title}</h2>
                            <p className="job-company">{jobData.company}</p>
                            {jobData.location && <p className="job-location"><MapPin size={14} /> {jobData.location}</p>}
                        </div>

                        {/* Quick Flags Preview */}
                        {(jobData.redFlags.length > 0 || jobData.greenFlags.length > 0) && (
                            <div className="flags-preview">
                                {jobData.redFlags.length > 0 && (
                                    <div className="flag-group flag-group--red">
                                        <h3><Flag size={18} /> Red Flags ({jobData.redFlags.length})</h3>
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
                                        <h3><CheckCircle size={18} /> Green Flags ({jobData.greenFlags.length})</h3>
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
                                        style={{ background: 'transparent', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
                                        onClick={handleOpenSettings}
                                    >
                                        Open Settings →
                                    </button>
                                )}
                            </div>
                        )}

                        {viewState === 'ready' && (
                            <button onClick={handleAnalyze} className="btn btn--primary btn--full">
                                <Zap size={20} /> Analyze Focus Area
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
                        <ScanSearch size={48} className="state-icon" style={{ opacity: 1, color: 'var(--text-main)', animation: 'pulse 1.5s infinite' }} />
                        <h2 style={{marginTop: '16px'}}>Analyzing Target...</h2>
                        <p>AI is assessing intelligence</p>
                    </div>
                )}
            </main>
        </div>
    );
};
