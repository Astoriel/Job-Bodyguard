import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { JobData } from '@job-bodyguard/types';
import { SavedJobsList } from './SavedJobsList';
import { HelpCircle, Bell, ScanLine, Edit3, Settings, FileBox, Bookmark, AlertTriangle, FileText } from 'lucide-react';

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

    const openHelp = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html?tab=help') });
        window.close();
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

    const saveLabel = { idle: <><Bookmark size={16}/> Save</>, saving: '⏳ Saving...', saved: '✅ Saved!', error: <><AlertTriangle size={16}/> Failed</> }[saveStatus];

    // ─── Loading ──────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="popup">
                <header className="popup-header">
                    <button className="icon-button" aria-label="Help">
                        <HelpCircle size={20} />
                    </button>
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
                <button className="icon-button" onClick={openHelp} title="Help & Feedback">
                    <HelpCircle size={20} />
                </button>
            </header>

            <main className="popup-content">
                <div className="greeting">
                    <span className="greeting-light">Hi there,</span>
                    <span className="greeting-bold">how can I help you today?</span>
                </div>

                {noContentScript && isJobPage && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: '12px', padding: '12px', marginBottom: '16px',
                        fontSize: '12px', color: '#ef4444', lineHeight: 1.5,
                    }}>
                        ⚠️ <strong>Refresh the tab (F5)</strong> so Job Bodyguard can read this page.
                    </div>
                )}

                {currentJob ? (
                    <div className="detected-banner">
                        <div className="detected-info">
                            <h4>{currentJob.title || 'Untitled'}</h4>
                            <p>{currentJob.company || 'Unknown Company'}</p>
                        </div>
                        <button
                            onClick={handleSaveNow}
                            className={`spy-button btn--secondary ${saveStatus !== 'idle' ? `btn--${saveStatus}` : ''}`}
                            disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                            style={{ backgroundColor: 'white', color: 'black', padding: '6px 14px', fontSize: '13px' }}
                        >
                            {saveStatus === 'idle' ? 'Save' : saveStatus === 'saved' ? 'Saved' : 'Saving...'}
                        </button>
                    </div>
                ) : (
                    <div className="cards-grid">
                        <button className="action-card" onClick={handleRefresh} disabled={!isJobPage}>
                            <ScanLine className="card-icon" size={24} />
                            <div style={{marginTop: 'auto'}}>
                                <div className="card-title">Scan</div>
                                <div className="card-subtitle">Current tab for job</div>
                            </div>
                        </button>
                        <button className="action-card action-card--accent" onClick={openSidePanel} disabled={!currentJob}>
                            <Edit3 className="card-icon" size={24} />
                            <div style={{marginTop: 'auto'}}>
                                <div className="card-title">Analyze</div>
                                <div className="card-subtitle">AI gap analysis</div>
                            </div>
                        </button>
                        <button className="action-card" onClick={openDashboard}>
                            <FileBox className="card-icon" size={24} />
                            <div style={{marginTop: 'auto'}}>
                                <div className="card-title">Dashboard</div>
                                <div className="card-subtitle">View saved jobs</div>
                            </div>
                        </button>
                        <button className="action-card" onClick={openSettings}>
                            <Settings className="card-icon" size={24} />
                            <div style={{marginTop: 'auto'}}>
                                <div className="card-title">Settings</div>
                                <div className="card-subtitle">App preferences</div>
                            </div>
                        </button>
                    </div>
                )}

                {currentJob && (
                    <div className="cards-grid">
                        <button className="action-card action-card--accent" onClick={openSidePanel}>
                            <Edit3 className="card-icon" size={24} />
                            <div style={{marginTop: 'auto'}}>
                                <div className="card-title">Analyze with AI</div>
                                <div className="card-subtitle">Check Red Flags</div>
                            </div>
                        </button>
                        <button className="action-card" onClick={openDashboard}>
                            <FileBox className="card-icon" size={24} />
                            <div style={{marginTop: 'auto'}}>
                                <div className="card-title">Dashboard</div>
                                <div className="card-subtitle">View all targets</div>
                            </div>
                        </button>
                    </div>
                )}

                {!hasResume && (
                    <div className="resume-prompt">
                        <div className="resume-prompt-content">
                            <FileText size={20} style={{color: '#f97316'}} />
                            <span className="resume-prompt-text">Add your resume for AI gap analysis</span>
                        </div>
                        <button onClick={openSettings} className="spy-button" style={{padding: '6px 14px', fontSize: '12px'}}>Upload</button>
                    </div>
                )}

                <SavedJobsList maxItems={2} />
            </main>
        </div>
    );
};
