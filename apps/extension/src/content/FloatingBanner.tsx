import React from 'react';
import type { JobData } from '@job-bodyguard/types';

interface FloatingBannerProps {
    jobData: JobData;
    onAnalyze: () => void;
    onClose: () => void;
}

export const FloatingBanner: React.FC<FloatingBannerProps> = ({
    jobData,
    onAnalyze,
    onClose,
}) => {
    const { jobAge, hiddenSalary, visibleSalary, redFlags, greenFlags, salaryMismatch } = jobData;

    // Format salary for display
    const formatSalary = () => {
        if (hiddenSalary) {
            const { min, max, currency } = hiddenSalary;
            const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency;
            if (min && max) {
                return `${currencySymbol}${(min / 1000).toFixed(0)}k - ${currencySymbol}${(max / 1000).toFixed(0)}k`;
            }
            if (min) return `${currencySymbol}${(min / 1000).toFixed(0)}k+`;
            if (max) return `Up to ${currencySymbol}${(max / 1000).toFixed(0)}k`;
        }
        return null;
    };

    const salary = formatSalary();
    const isOldPosting = jobAge !== null && jobAge > 30;

    return (
        <div className="jb-banner">
            <span className="jb-logo">🛡️</span>

            <div className="jb-banner__content">
                {/* Job Age */}
                {jobAge !== null && (
                    <span className={`jb-badge jb-badge--age ${isOldPosting ? 'old' : ''}`}>
                        ⏰ {jobAge} {jobAge === 1 ? 'day' : 'days'} ago
                    </span>
                )}

                {/* Hidden Salary */}
                {salary && salaryMismatch && (
                    <span className="jb-badge jb-badge--salary">
                        💰 Hidden: {salary}
                    </span>
                )}

                {/* Visible Salary if no mismatch */}
                {visibleSalary && !salaryMismatch && (
                    <span className="jb-badge jb-badge--salary">
                        💰 {visibleSalary}
                    </span>
                )}

                {/* Red Flags Count */}
                {redFlags.length > 0 && (
                    <span className="jb-badge jb-badge--red">
                        🚩 {redFlags.length} red flag{redFlags.length > 1 ? 's' : ''}
                    </span>
                )}

                {/* Green Flags Count */}
                {greenFlags.length > 0 && (
                    <span className="jb-badge jb-badge--green">
                        ✅ {greenFlags.length} green flag{greenFlags.length > 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Analyze Button */}
            <button onClick={onAnalyze} className="jb-btn jb-btn--primary">
                🔍 Analyze
            </button>

            {/* Close Button */}
            <button onClick={onClose} className="jb-btn jb-btn--ghost" title="Close">
                ✕
            </button>
        </div>
    );
};
