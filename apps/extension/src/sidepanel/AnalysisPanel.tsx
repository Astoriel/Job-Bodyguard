import React from 'react';
import type { JobData, AnalysisResult } from '@job-bodyguard/types';

interface AnalysisPanelProps {
    jobData: JobData;
    result: AnalysisResult;
    onTailor: () => void;
    onSave: () => void;
    onReanalyze: () => void;
    saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
    saveButtonContent?: React.ReactNode;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
    jobData,
    result,
    onTailor,
    onSave,
    onReanalyze,
    saveStatus = 'idle',
    saveButtonContent = <><span className="spy-icon">&#x0446;</span> Save & Apply</>,
}) => {
    const getVerdictColor = () => {
        switch (result.verdict) {
            case 'strong_apply': return '#10b981';
            case 'apply': return '#34d399';
            case 'caution': return '#fbbf24';
            case 'skip': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const getVerdictEmoji = () => {
        switch (result.verdict) {
            case 'strong_apply': return '🚀';
            case 'apply': return '✅';
            case 'caution': return <span className="spy-icon">&#x0053;</span>;
            case 'skip': return '🚫';
            default: return '❓';
        }
    };

    return (
        <div className="analysis-panel">
            {/* Roast Section */}
            <section className="section section--roast">
                <h3>🔥 The Roast</h3>
                <p className="roast-text">{result.roast}</p>
            </section>

            {/* Verdict */}
            <section className="section section--verdict">
                <div className="verdict-card" style={{ borderColor: getVerdictColor() }}>
                    <span className="verdict-emoji">{getVerdictEmoji()}</span>
                    <div className="verdict-content">
                        <span className="verdict-label" style={{ color: getVerdictColor() }}>
                            {result.verdict.replace('_', ' ').toUpperCase()}
                        </span>
                        <p className="verdict-text">{result.verdictText}</p>
                    </div>
                </div>
            </section>

            {/* Scores */}
            <section className="section section--scores">
                <div className="score-cards">
                    <div className="score-card">
                        <div className="score-label">Toxicity</div>
                        <div className="score-bar">
                            <div
                                className="score-fill score-fill--toxicity"
                                style={{ width: `${result.toxicityScore}%` }}
                            />
                        </div>
                        <div className="score-value">{result.toxicityScore}/100</div>
                    </div>

                    <div className="score-card">
                        <div className="score-label">Compatibility</div>
                        <div className="score-bar">
                            <div
                                className="score-fill score-fill--compatibility"
                                style={{ width: `${result.compatibilityScore}%` }}
                            />
                        </div>
                        <div className="score-value">{result.compatibilityScore}/100</div>
                    </div>
                </div>
            </section>

            {/* Red Flags */}
            {result.redFlags.length > 0 && (
                <section className="section section--flags">
                    <h3>🚩 Red Flags</h3>
                    <div className="flags-list">
                        {result.redFlags.map((flag, i) => (
                            <div key={i} className="flag-item flag-item--red">
                                <div className="flag-header">
                                    <span className={`severity severity--${flag.severity}`}>{flag.severity}</span>
                                    <span className="flag-title">{flag.flag}</span>
                                </div>
                                <p className="flag-explanation">{flag.explanation}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Green Flags */}
            {result.greenFlags.length > 0 && (
                <section className="section section--flags">
                    <h3>✅ Green Flags</h3>
                    <div className="flags-list">
                        {result.greenFlags.map((flag, i) => (
                            <div key={i} className="flag-item flag-item--green">
                                <span className="flag-title">{flag.flag}</span>
                                <p className="flag-explanation">{flag.explanation}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Gap Analysis */}
            {result.gapAnalysis.missingSkills.length > 0 && (
                <section className="section section--gap">
                    <h3><span className="spy-icon">&#x01D1;</span> Resume Gap Analysis</h3>
                    <div className="gap-content">
                        <div className="gap-group">
                            <h4>Missing Skills</h4>
                            <div className="skills-tags">
                                {result.gapAnalysis.missingSkills.map((skill, i) => (
                                    <span key={i} className="skill-tag">{skill}</span>
                                ))}
                            </div>
                        </div>
                        {result.gapAnalysis.suggestions.length > 0 && (
                            <div className="gap-group">
                                <h4>Suggestions</h4>
                                <ul className="suggestions-list">
                                    {result.gapAnalysis.suggestions.map((suggestion, i) => (
                                        <li key={i}>{suggestion}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Interview Questions */}
            <section className="section section--questions">
                <h3>💬 Interview Ammo</h3>
                <p className="section-subtitle">Questions to ask the recruiter:</p>
                <ol className="questions-list">
                    {result.interviewQuestions.map((q, i) => (
                        <li key={i}>{q}</li>
                    ))}
                </ol>
            </section>

            {/* Actions */}
            <section className="section section--actions">
                <button onClick={onTailor} className="btn btn--primary btn--full">
                    ✂️ Tailor My Resume
                </button>
                <div className="action-row">
                    <button
                        onClick={onSave}
                        className={`btn btn--secondary ${saveStatus === 'saved' ? 'btn--saved' : ''} ${saveStatus === 'error' ? 'btn--error' : ''}`}
                        disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                    >
                        {saveButtonContent}
                    </button>
                    <button onClick={onReanalyze} className="btn btn--ghost">
                        <span className="spy-icon">&#x0155;</span> Re-analyze
                    </button>
                </div>
            </section>
        </div>
    );
};
