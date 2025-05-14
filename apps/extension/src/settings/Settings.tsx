import React, { useEffect, useState } from 'react';

interface ExtensionSettings {
    apiKey: string;
    apiProvider: 'openai' | 'anthropic' | 'custom';
    customApiUrl: string;
    customPrompt: string;
    resumeText: string;
}

const DEFAULT_SETTINGS: ExtensionSettings = {
    apiKey: '',
    apiProvider: 'openai',
    customApiUrl: '',
    customPrompt: '',
    resumeText: '',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export const Settings: React.FC = () => {
    const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [showKey, setShowKey] = useState(false);
    const [clearState, setClearState] = useState<SaveState>('idle');

    useEffect(() => {
        chrome.runtime.sendMessage(
            { type: 'GET_SETTINGS', payload: null, timestamp: Date.now() },
            (response) => {
                if (response?.success && response.data) {
                    setSettings({ ...DEFAULT_SETTINGS, ...response.data });
                }
            }
        );
    }, []);

    const handleSave = () => {
        setSaveState('saving');
        chrome.runtime.sendMessage(
            { type: 'SAVE_SETTINGS', payload: settings, timestamp: Date.now() },
            (response) => {
                if (response?.success) {
                    setSaveState('saved');
                    setTimeout(() => setSaveState('idle'), 2500);
                } else {
                    setSaveState('error');
                    setTimeout(() => setSaveState('idle'), 3000);
                }
            }
        );
    };

    const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setSettings(prev => ({ ...prev, resumeText: text }));
        };
        reader.readAsText(file);
    };

    const handleClearJobs = () => {
        if (!confirm('Clear ALL saved jobs? This cannot be undone.')) return;
        setClearState('saving');
        chrome.storage.sync.remove('savedJobs', () => {
            chrome.storage.local.remove('savedJobs', () => {
                setClearState('saved');
                setTimeout(() => setClearState('idle'), 2500);
            });
        });
    };

    return (
        <div className="settings-page">
            {/* Header */}
            <header className="settings-header">
                <div className="settings-logo">
                    <span className="spy-icon">&#x0669;</span>
                    <span className="settings-logo-text">Job Bodyguard</span>
                    <span className="settings-subtitle">Settings</span>
                </div>
                <a href={chrome.runtime.getURL('dashboard.html')} className="settings-back-btn">
                    ← Dashboard
                </a>
            </header>

            <div className="settings-body">
                <div className="settings-sections">

                    {/* AI Provider */}
                    <section className="settings-section">
                        <h2 className="section-title"><span className="spy-icon">&#x05EE;</span> AI Provider</h2>
                        <p className="section-desc">
                            Your API key is stored locally in Chrome and is only sent directly to the AI provider you choose.
                            We never see your key.
                        </p>

                        <div className="field">
                            <label>Provider</label>
                            <div className="radio-group">
                                {['openai', 'anthropic', 'custom'].map(p => (
                                    <button
                                        key={p}
                                        className={`radio-btn ${settings.apiProvider === p ? 'active' : ''}`}
                                        onClick={() => setSettings(prev => ({ ...prev, apiProvider: p as ExtensionSettings['apiProvider'] }))}
                                    >
                                        {p === 'openai' && '⚪ OpenAI'}
                                        {p === 'anthropic' && '🟠 Anthropic'}
                                        {p === 'custom' && '🔧 Custom'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="field">
                            <label>API Key</label>
                            <div className="input-row">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    className="input"
                                    placeholder={
                                        settings.apiProvider === 'openai'
                                            ? 'sk-...'
                                            : settings.apiProvider === 'anthropic'
                                                ? 'sk-ant-...'
                                                : 'Your API key'
                                    }
                                    value={settings.apiKey}
                                    onChange={e => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                                />
                                <button
                                    className="icon-btn"
                                    onClick={() => setShowKey(!showKey)}
                                    title={showKey ? 'Hide key' : 'Show key'}
                                >
                                    {showKey ? '🙈' : '👁️'}
                                </button>
                            </div>
                            <p className="field-hint">
                                {settings.apiProvider === 'openai' && 'Get yours at platform.openai.com — gpt-4o-mini is used (cheap & fast)'}
                                {settings.apiProvider === 'anthropic' && 'Get yours at console.anthropic.com — claude-haiku is used'}
                                {settings.apiProvider === 'custom' && 'Enter the base URL of your OpenAI-compatible endpoint below'}
                            </p>
                        </div>

                        {settings.apiProvider === 'custom' && (
                            <div className="field">
                                <label>Custom API URL</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="https://your-endpoint.com/v1/chat/completions"
                                    value={settings.customApiUrl}
                                    onChange={e => setSettings(prev => ({ ...prev, customApiUrl: e.target.value }))}
                                />
                            </div>
                        )}
                    </section>

                    {/* Resume */}
                    <section className="settings-section">
                        <h2 className="section-title"><span className="spy-icon">&#x0249;</span> Your Resume</h2>
                        <p className="section-desc">
                            Upload your resume as a text or PDF file. It's used for AI gap analysis and resume tailoring.
                        </p>

                        <div className="field">
                            <label htmlFor="resume-upload">Resume File</label>
                            <div className="upload-area">
                                <input
                                    id="resume-upload"
                                    type="file"
                                    accept=".txt,.md,.pdf"
                                    onChange={handleResumeUpload}
                                    className="file-input"
                                />
                                <label htmlFor="resume-upload" className="upload-label">
                                    {settings.resumeText
                                        ? `✅ Resume loaded (${(settings.resumeText.length / 1000).toFixed(1)}k chars)`
                                        : '📂 Click to upload .txt or .md file'}
                                </label>
                            </div>
                        </div>

                        {settings.resumeText && (
                            <div className="field">
                                <label>Resume Preview</label>
                                <textarea
                                    className="textarea"
                                    value={settings.resumeText}
                                    rows={8}
                                    onChange={e => setSettings(prev => ({ ...prev, resumeText: e.target.value }))}
                                />
                            </div>
                        )}
                    </section>

                    {/* Custom Prompt */}
                    <section className="settings-section">
                        <h2 className="section-title"><span className="spy-icon">&#x035E;</span> Custom System Prompt</h2>
                        <p className="section-desc">
                            Override the default personality of the AI. Leave blank to use the built-in sarcastic analyst.
                        </p>
                        <div className="field">
                            <textarea
                                className="textarea"
                                rows={5}
                                placeholder="You are a senior recruiter. Analyze job descriptions and..."
                                value={settings.customPrompt}
                                onChange={e => setSettings(prev => ({ ...prev, customPrompt: e.target.value }))}
                            />
                        </div>
                    </section>

                    {/* Danger Zone */}
                    <section className="settings-section settings-section--danger">
                        <h2 className="section-title section-title--danger">⚠️ Danger Zone</h2>
                        <div className="danger-row">
                            <div>
                                <div className="danger-title">Clear Saved Jobs</div>
                                <div className="danger-desc">Permanently remove all saved job applications</div>
                            </div>
                            <button
                                className="danger-btn"
                                onClick={handleClearJobs}
                                disabled={clearState === 'saving'}
                            >
                                {clearState === 'saving' ? '⏳ Clearing...' : clearState === 'saved' ? '✅ Cleared' : <><span className="spy-icon">&#x00EC;</span> Clear All</>}
                            </button>
                        </div>
                    </section>
                </div>

                {/* Save button */}
                <div className="settings-footer">
                    <button
                        className={`save-btn ${saveState === 'saved' ? 'save-btn--success' : ''} ${saveState === 'error' ? 'save-btn--error' : ''}`}
                        onClick={handleSave}
                        disabled={saveState === 'saving'}
                    >
                        {saveState === 'saving' ? '⏳ Saving...' : saveState === 'saved' ? '✅ Settings Saved!' : saveState === 'error' ? <><span className="spy-icon">&#x0203;</span> Error Saving</> : <><span className="spy-icon">&#x0446;</span> Save Settings</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
