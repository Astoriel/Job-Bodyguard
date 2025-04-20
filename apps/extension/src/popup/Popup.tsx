import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { JobData } from '@job-bodyguard/types';
import { SavedJobsList } from './SavedJobsList';

// ─── URL helpers ──────────────────────────────────────────────────────────────

function checkIsJobPage(url: string): boolean {
    return /linkedin\.com\/jobs|indeed\.com\/(m\/)?viewjob|indeed\.com\/(m\/)?jobs|indeed\.com\/.*[?&](vjk|jk)=|indeed\.com\/rc\/clk|indeed\.com\/pagead|hh\.ru\/vacancy/i.test(url);
}

function extractJobKey(url: string): string {
    try {
        const u = new URL(url);
        return (
            u.searchParams.get('jk') ||
            u.searchParams.get('vjk') ||
            u.searchParams.get('currentJobId') ||
            u.pathname.match(/\/vacancy\/(\d+)/)?.[1] ||
            ''
        );
    } catch { return ''; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Popup: React.FC = () => {
    const [currentJob, setCurrentJob] = useState<JobData | null>(null);
    const [hasResume, setHasResume] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [tabUrl, setTabUrl] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [noContentScript, setNoContentScript] = useState(false);

    // ─── Refs (avoid stale closures in useCallback) ───────────────
    const tabInfoRef = useRef<{ url: string; id?: number }>({ url: '' });
    const reparseRef = useRef(false);   // was re-parse already requested?
    const fetchingRef = useRef(false);   // prevent concurrent fetches

    // ─── Core fetch — no state dependencies (uses refs) ───────────
    const fetchCurrentJob = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        try {
            const { url: tabUrl, id: tabId } = tabInfoRef.current;
            const result = await chrome.storage.local.get('currentJob');
            const job: JobData | null = result.currentJob ?? null;

            const storedKey = extractJobKey(job?.url ?? '');
            const tabKey = extractJobKey(tabUrl);

            console.log('[JBG Popup] fetch → job:', job ? `"${job.title}"` : 'null',
                '| storedKey:', storedKey, '| tabKey:', tabKey);

            // Stale: both keys exist and differ
            const isStale = !!(tabKey && storedKey && tabKey !== storedKey);
            // Also stale: tab has a key, stored job has NO key at all
            const isStale2 = !!(tabKey && !storedKey && job != null);

            const finalJob = (isStale || isStale2) ? null : job;
            setCurrentJob(finalJob);
            if (finalJob) setLastUpdated(new Date());

            // Ask content script to re-parse — but only ONCE per popup session
            const onJobPage = checkIsJobPage(tabUrl);
            if (onJobPage && !finalJob && tabId && !reparseRef.current) {
                reparseRef.current = true;   // ← ref, not state → no stale closure!
                console.log('[JBG Popup] Requesting content script re-parse (once)...');
                chrome.tabs.sendMessage(
                    tabId,
                    { type: 'JBG_TRIGGER_PARSE' },
                    (response) => {
                        const err = chrome.runtime.lastError;
                        if (err || !response) {
                            console.warn('[JBG Popup] Content script is NOT present:', err?.message);
                            setNoContentScript(true);
                        } else {
                            console.log('[JBG Popup] Content script acknowledged re-parse ✓');
                        }
                    }
                );
            }
        } finally {
            fetchingRef.current = false;
            setIsLoading(false);
        }
    }, []); // stable — reads from refs, not state

    // ─── Init ─────────────────────────────────────────────────────
    useEffect(() => {
        // Resume check
        chrome.storage.local.get('resume', (res) => { setHasResume(!!res.resume); });
        chrome.storage.sync.get('settings', (res) => {
            if (res.settings?.resumeText) setHasResume(true);
        });

        // Get tab info, then fetch ONCE
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = tabs[0]?.url ?? '';
            const id = tabs[0]?.id;
            tabInfoRef.current = { url, id };
            setTabUrl(url);
            void fetchCurrentJob();
        });

        // Storage listener — ONLY react when a real job is written (not when cleared)
        const storageListener = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string,
        ) => {
            // Only local storage, only currentJob key, only non-null new value
            if (area === 'local' && 'currentJob' in changes && changes.currentJob.newValue) {
                console.log('[JBG Popup] storage changed → new job written, re-fetching');
                void fetchCurrentJob();
            }
        };

        chrome.storage.onChanged.addListener(storageListener);
        return () => chrome.storage.onChanged.removeListener(storageListener);
    }, [fetchCurrentJob]); // fetchCurrentJob is stable → runs exactly once

    // ─── Derived ──────────────────────────────────────────────────
    const isJobPage = checkIsJobPage(tabUrl);

    // ─── Actions ──────────────────────────────────────────────────
    const handleRefresh = () => {
        reparseRef.current = false;   // allow a new re-parse request
        setNoContentScript(false);
        setIsLoading(true);
        void fetchCurrentJob();
    };

    const openSidePanel = () => {
        chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL', payload: null, timestamp: Date.now() });
        window.close();
    };

    const handleSaveNow = () => {
        if (!currentJob || saveStatus !== 'idle') return;
        setSaveStatus('saving');
        chrome.runtime.sendMessage(
            { type: 'SAVE_TO_DASHBOARD', payload: currentJob, timestamp: Date.now() },
            (res) => {
                setSaveStatus(res?.success ? 'saved' : 'error');
                setTimeout(() => setSaveStatus('idle'), 2500);
            }
        );
    };

    const openDashboard = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        window.close();
    };

    const openSettings = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
        window.close();
    };

    const saveLabel = { idle: <><span className="spy-icon">&#x0446;</span> Save</>, saving: '⏳ Saving...', saved: '✅ Saved!', error: <><span className="spy-icon">&#x0203;</span> Failed</> }[saveStatus];

    // ─── Loading ──────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="popup">
                <header className="popup-header">
                    <div className="popup-logo">
                        <span className="spy-icon popup-logo-icon">&#x0669;</span>
                        <span className="popup-logo-text">Job Bodyguard</span>
                    </div>
                </header>
                <div className="popup-loading">
                    <div className="spinner" />
                    <span>Reading page...</span>
                </div>
            </div>
        );
    }

    // ─── Render ───────────────────────────────────────────────────
    return (
        <div className="popup">
            <header className="popup-header">
                <div className="popup-logo">
                    <span className="spy-icon popup-logo-icon">&#x0669;</span>
                    <span className="popup-logo-text">Job Bodyguard</span>
                </div>
                <button className="btn btn--icon" onClick={handleRefresh} title="Refresh"><span className="spy-icon">ŕ</span></button>
            </header>

            <main className="popup-content">

                {/* Content script absent — user needs to refresh tab */}
                {noContentScript && isJobPage && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                        fontSize: 11, color: '#fca5a5', lineHeight: 1.5,
                    }}>
                        ⚠️ <strong>Refresh the tab (F5)</strong> so Job Bodyguard can read this page.
                        <br />
                        <span style={{ opacity: 0.7 }}>
                            (Extension was updated after the tab was opened)
                        </span>
                    </div>
                )}

                {currentJob ? (
                    <div className="current-job">
                        <div className="current-job-meta">
                            <span className="current-job-label"><span className="spy-icon" style={{ color: 'var(--spy-red)' }}>&#x0268;</span> Detected job</span>
                            {lastUpdated && (
                                <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 6 }}>
                                    Updated {lastUpdated.toLocaleTimeString()}
                                </span>
                            )}
                        </div>
                        <div className="current-job-title">{currentJob.title || 'Untitled'}</div>
                        <div className="current-job-company">{currentJob.company || '—'}</div>

                        <div className="quick-stats">
                            {currentJob.jobAge != null && (
                                <span className="stat stat--age">⏰ {currentJob.jobAge}d ago</span>
                            )}
                            {currentJob.redFlags?.length > 0 && (
                                <span className="stat stat--red">🚩 {currentJob.redFlags.length}</span>
                            )}
                            {currentJob.greenFlags?.length > 0 && (
                                <span className="stat stat--green">✅ {currentJob.greenFlags.length}</span>
                            )}
                        </div>

                        <div className="action-row">
                            <button onClick={openSidePanel} className="btn btn--primary btn--full">
                                <span className="spy-icon">&#x04E4;</span> Analyze with AI
                            </button>
                        </div>
                        <div className="action-row">
                            <button
                                onClick={handleSaveNow}
                                className={`btn btn--secondary btn--full ${saveStatus !== 'idle' ? `btn--${saveStatus}` : ''}`}
                                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                            >
                                {saveLabel}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="no-job">
                        <div className="no-job-icon">{isJobPage ? '⏳' : <span className="spy-icon">&#x0232;</span>}</div>
                        <div className="no-job-text">
                            {noContentScript
                                ? 'Please refresh the tab to activate'
                                : isJobPage
                                    ? 'Parsing job...'
                                    : 'Open a job on LinkedIn, Indeed, or hh.ru'}
                        </div>
                        {isJobPage && (
                            <button onClick={handleRefresh}
                                className="btn btn--secondary btn--small"
                                style={{ marginTop: 8 }}>
                                <span className="spy-icon">ŕ</span> Retry
                            </button>
                        )}
                    </div>
                )}

                <SavedJobsList maxItems={2} />

                {!hasResume && (
                    <div className="resume-prompt">
                        <span className="spy-icon">&#x0249;</span>
                        <span>Add your resume for AI gap analysis</span>
                        <button onClick={openSettings} className="btn btn--ghost btn--small">Upload</button>
                    </div>
                )}
            </main>

            <footer className="popup-footer">
                <button onClick={openDashboard} className="btn btn--ghost"><span className="spy-icon">&#x01D1;</span> Dashboard</button>
                <button onClick={openSettings} className="btn btn--ghost"><span className="spy-icon">&#x054D;</span> Settings</button>
            </footer>
        </div>
    );
};
