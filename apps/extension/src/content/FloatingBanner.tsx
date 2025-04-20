import React, { useState } from 'react';
import type { JobData } from '@job-bodyguard/types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FloatingBannerProps {
    jobData: JobData;
    onAnalyze: () => void;
    /** onSave receives a callback to report success/failure */
    onSave: (onResult: (ok: boolean) => void) => void;
    onClose: () => void;
}

export const FloatingBanner: React.FC<FloatingBannerProps> = ({
    jobData,
    onAnalyze,
    onSave,
    onClose,
}) => {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

    const { jobAge, hiddenSalary, visibleSalary, redFlags, greenFlags, salaryMismatch } = jobData;

    const isOldPosting = jobAge !== null && jobAge > 30;

    // Format hidden salary, respecting the pay period
    const salaryText = (() => {
        if (!hiddenSalary) return null;
        const { min, max, currency, period } = hiddenSalary;
        const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency ?? '';

        if (period === 'HOUR') {
            // Hourly: show as $40–$80/hr
            if (min && max) return `${sym}${min}–${sym}${max}/hr`;
            if (min) return `${sym}${min}+/hr`;
            if (max) return `Up to ${sym}${max}/hr`;
        } else if (period === 'MONTH') {
            // Monthly: show as $4k/mo
            const fmt = (v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v);
            if (min && max) return `${sym}${fmt(min)}–${sym}${fmt(max)}/mo`;
            if (min) return `${sym}${fmt(min)}+/mo`;
            if (max) return `Up to ${sym}${fmt(max)}/mo`;
        } else {
            // Annual (YEAR): divide by 1000 → k notation
            if (min && max) return `${sym}${Math.round(min / 1000)}k–${sym}${Math.round(max / 1000)}k`;
            if (min) return `${sym}${Math.round(min / 1000)}k+`;
            if (max) return `Up to ${sym}${Math.round(max / 1000)}k`;
        }
        return null;
    })();

    const handleSave = () => {
        if (saveStatus !== 'idle') return;
        setSaveStatus('saving');
        onSave((ok) => {
            setSaveStatus(ok ? 'saved' : 'error');
            // Reset after 3 seconds so the user can retry on error
            setTimeout(() => setSaveStatus('idle'), ok ? 4000 : 3000);
        });
    };

    const saveLabel = {
        idle: '💾 Save',
        saving: '⏳ Saving...',
        saved: '✅ Saved!',
        error: '❌ Failed',
    }[saveStatus];

    return (
        <div className="banner">
            <span className="banner__logo"><span className="spy-icon">&#x0669;</span></span>

            {/* Flag badges */}
            <div className="banner__flags">
                {jobAge !== null && (
                    <span className={`badge ${isOldPosting ? 'badge--old' : 'badge--age'}`}>
                        ⏰ {jobAge}d ago
                    </span>
                )}

                {salaryText && (salaryMismatch || !visibleSalary) && (
                    <span className="badge badge--sal">
                        💰 {salaryMismatch ? 'Hidden: ' : ''}{salaryText}
                    </span>
                )}

                {visibleSalary && !salaryMismatch && (
                    <span className="badge badge--sal">
                        💰 {visibleSalary}
                    </span>
                )}

                {redFlags.length > 0 && (
                    <span className="badge badge--red">
                        🚩 {redFlags.length} red flag{redFlags.length > 1 ? 's' : ''}
                    </span>
                )}

                {greenFlags.length > 0 && (
                    <span className="badge badge--green">
                        ✅ {greenFlags.length} green flag{greenFlags.length > 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Action buttons */}
            <div className="banner__actions">
                <button
                    className="btn btn--analyze"
                    onClick={onAnalyze}
                    title="Open AI analysis in side panel"
                >
                    🔍 Analyze
                </button>

                <button
                    className={`btn btn--save ${saveStatus !== 'idle' ? saveStatus : ''}`}
                    onClick={handleSave}
                    disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                    title="Save this job to your dashboard"
                >
                    {saveLabel}
                </button>

                <button
                    className="btn btn--close"
                    onClick={onClose}
                    title="Dismiss"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};
