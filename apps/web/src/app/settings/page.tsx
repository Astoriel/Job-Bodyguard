'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Settings {
    apiKey: string;
    apiProvider: 'openai' | 'anthropic' | 'custom';
    customApiUrl: string;
    customPrompt: string;
    resumeText: string;
}

const DEFAULT_PROMPT = `You are an expert job posting analyst with a sarcastic but helpful personality.
Analyze this job posting and provide:
1. A brutally honest "roast" of the posting (2-3 sentences, witty and insightful)
2. Toxicity score (0-100) based on red flags
3. Compatibility score (0-100) if resume provided
4. Decoded red flags with explanations
5. Genuine green flags
6. Gap analysis comparing requirements vs resume
7. Interview questions to ask the employer
8. Final verdict: "go", "caution", or "run"`;

export default function SettingsPage(): JSX.Element {
    const [settings, setSettings] = useState<Settings>({
        apiKey: '',
        apiProvider: 'openai',
        customApiUrl: '',
        customPrompt: DEFAULT_PROMPT,
        resumeText: '',
    });
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load settings from localStorage
        const stored = localStorage.getItem('jobBodyguardSettings');
        if (stored) {
            try {
                setSettings(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse settings:', e);
            }
        }
        setLoading(false);
    }, []);

    const handleSave = () => {
        localStorage.setItem('jobBodyguardSettings', JSON.stringify(settings));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleResetPrompt = () => {
        setSettings(prev => ({ ...prev, customPrompt: DEFAULT_PROMPT }));
    };

    const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            setSettings(prev => ({ ...prev, resumeText: text }));
        };
        reader.readAsText(file);
    };

    if (loading) {
        return (
            <div className="settings-page">
                <div className="loading-spinner">Loading...</div>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <nav className="dashboard-nav">
                <div className="nav-content">
                    <Link href="/" className="logo">
                        <span className="logo-icon">🛡️</span>
                        <span className="logo-text">Job Bodyguard</span>
                    </Link>
                    <div className="nav-links">
                        <Link href="/dashboard" className="nav-link">Applications</Link>
                        <Link href="/settings" className="nav-link active">Settings</Link>
                    </div>
                </div>
            </nav>

            <main className="settings-content">
                <div className="settings-header">
                    <h1>⚙️ Settings</h1>
                    <p className="text-muted">Configure your Job Bodyguard preferences</p>
                </div>

                <div className="settings-sections">
                    {/* AI Configuration Section */}
                    <section className="settings-section card">
                        <h2>🤖 AI Configuration</h2>

                        <div className="form-group">
                            <label htmlFor="apiProvider">AI Provider</label>
                            <select
                                id="apiProvider"
                                value={settings.apiProvider}
                                onChange={(e) => setSettings(prev => ({
                                    ...prev,
                                    apiProvider: e.target.value as Settings['apiProvider']
                                }))}
                            >
                                <option value="openai">OpenAI (GPT-4)</option>
                                <option value="anthropic">Anthropic (Claude)</option>
                                <option value="custom">Custom API</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="apiKey">
                                API Key
                                <span className="hint">Your key is stored locally and never sent to our servers</span>
                            </label>
                            <input
                                type="password"
                                id="apiKey"
                                value={settings.apiKey}
                                onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                                placeholder="sk-..."
                            />
                        </div>

                        {settings.apiProvider === 'custom' && (
                            <div className="form-group">
                                <label htmlFor="customApiUrl">Custom API URL</label>
                                <input
                                    type="url"
                                    id="customApiUrl"
                                    value={settings.customApiUrl}
                                    onChange={(e) => setSettings(prev => ({ ...prev, customApiUrl: e.target.value }))}
                                    placeholder="https://api.example.com/v1/chat/completions"
                                />
                            </div>
                        )}
                    </section>

                    {/* Custom Prompt Section */}
                    <section className="settings-section card">
                        <div className="section-header">
                            <h2>📝 Custom AI Prompt</h2>
                            <button
                                onClick={handleResetPrompt}
                                className="btn btn--ghost btn--small"
                            >
                                Reset to Default
                            </button>
                        </div>

                        <div className="form-group">
                            <label htmlFor="customPrompt">
                                System Prompt
                                <span className="hint">Customize how the AI analyzes job postings</span>
                            </label>
                            <textarea
                                id="customPrompt"
                                value={settings.customPrompt}
                                onChange={(e) => setSettings(prev => ({ ...prev, customPrompt: e.target.value }))}
                                rows={10}
                                placeholder="Enter your custom prompt..."
                            />
                        </div>
                    </section>

                    {/* Resume Section */}
                    <section className="settings-section card">
                        <h2>📄 Resume</h2>

                        <div className="form-group">
                            <label htmlFor="resumeUpload">
                                Upload Resume (TXT format)
                                <span className="hint">Used for personalized gap analysis</span>
                            </label>
                            <input
                                type="file"
                                id="resumeUpload"
                                accept=".txt,.md"
                                onChange={handleResumeUpload}
                            />
                        </div>

                        {settings.resumeText && (
                            <div className="resume-preview">
                                <h4>Current Resume:</h4>
                                <pre>{settings.resumeText.substring(0, 500)}...</pre>
                                <button
                                    onClick={() => setSettings(prev => ({ ...prev, resumeText: '' }))}
                                    className="btn btn--ghost btn--small"
                                >
                                    Remove Resume
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Save Button */}
                    <div className="settings-actions">
                        <button onClick={handleSave} className="btn btn--primary btn--large">
                            {saved ? '✅ Saved!' : '💾 Save Settings'}
                        </button>
                    </div>
                </div>
            </main>

            <style jsx>{`
        .settings-page {
          min-height: 100vh;
          background: var(--bg-primary);
        }
        
        .settings-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }
        
        .settings-header {
          margin-bottom: 2rem;
        }
        
        .settings-header h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
        
        .settings-sections {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .settings-section {
          padding: 1.5rem;
        }
        
        .settings-section h2 {
          font-size: 1.25rem;
          margin-bottom: 1rem;
          color: var(--text-primary);
        }
        
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .section-header h2 {
          margin-bottom: 0;
        }
        
        .form-group {
          margin-bottom: 1rem;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: var(--text-primary);
        }
        
        .form-group .hint {
          display: block;
          font-size: 0.8rem;
          font-weight: normal;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }
        
        .form-group input[type="text"],
        .form-group input[type="password"],
        .form-group input[type="url"],
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 1rem;
          font-family: inherit;
        }
        
        .form-group textarea {
          resize: vertical;
          font-family: monospace;
          font-size: 0.875rem;
        }
        
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.1);
        }
        
        .resume-preview {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--bg-tertiary);
          border-radius: 8px;
        }
        
        .resume-preview h4 {
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }
        
        .resume-preview pre {
          font-size: 0.75rem;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 150px;
          overflow: auto;
          background: var(--bg-primary);
          padding: 0.5rem;
          border-radius: 4px;
          margin-bottom: 0.5rem;
        }
        
        .settings-actions {
          margin-top: 1rem;
          display: flex;
          justify-content: flex-end;
        }
        
        .btn--large {
          padding: 1rem 2rem;
          font-size: 1.1rem;
        }
      `}</style>
        </div>
    );
}
