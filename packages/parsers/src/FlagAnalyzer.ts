import type { Flag } from '@job-bodyguard/types';

interface FlagPattern {
    pattern: RegExp;
    label: string;
    category: Flag['category'];
    severity: Flag['severity'];
}

/**
 * Analyzes job posting text for red and green flags
 */
export class FlagAnalyzer {
    private redFlagPatterns: FlagPattern[] = [
        // Workload concerns
        { pattern: /fast[- ]?paced\s*(environment)?/i, label: 'Fast-paced environment', category: 'workload', severity: 'medium' },
        { pattern: /wear\s*(many|multiple)\s*hats/i, label: 'Undefined role', category: 'workload', severity: 'high' },
        { pattern: /work\s*hard[,\s]*play\s*hard/i, label: 'Likely overtime expected', category: 'workload', severity: 'high' },
        { pattern: /startup\s*mentality/i, label: 'Chaotic environment', category: 'workload', severity: 'medium' },
        { pattern: /self[- ]?starter/i, label: 'Minimal training/support', category: 'workload', severity: 'low' },
        { pattern: /hit\s*the\s*ground\s*running/i, label: 'No onboarding', category: 'workload', severity: 'medium' },
        { pattern: /fast[- ]?moving/i, label: 'High pressure', category: 'workload', severity: 'medium' },

        // Culture red flags
        { pattern: /like\s*a?\s*family/i, label: 'Blurred professional boundaries', category: 'culture', severity: 'high' },
        { pattern: /rock\s*star|ninja|guru|wizard/i, label: 'Unrealistic expectations', category: 'culture', severity: 'medium' },
        { pattern: /hustle\s*(culture)?/i, label: 'Burnout culture', category: 'culture', severity: 'high' },
        { pattern: /no\s*ego/i, label: 'May dismiss valid concerns', category: 'culture', severity: 'low' },

        // Compensation concerns
        { pattern: /competitive\s*salary/i, label: 'Salary not disclosed', category: 'compensation', severity: 'medium' },
        { pattern: /unpaid|volunteer/i, label: 'No compensation', category: 'compensation', severity: 'critical' },
        { pattern: /equity\s*only/i, label: 'No cash compensation', category: 'compensation', severity: 'critical' },
        { pattern: /doe|depending\s*on\s*experience/i, label: 'Vague compensation', category: 'compensation', severity: 'low' },

        // Management red flags
        { pattern: /high[- ]?pressure/i, label: 'Stressful environment', category: 'management', severity: 'high' },
        { pattern: /must\s*(be\s*able\s*to\s*)?handle\s*stress/i, label: 'Poor management', category: 'management', severity: 'high' },
        { pattern: /thick\s*skin/i, label: 'Toxic environment', category: 'management', severity: 'high' },
        { pattern: /dynamic\s*environment/i, label: 'Disorganized workplace', category: 'management', severity: 'medium' },

        // Growth concerns
        { pattern: /entry[- ]?level.{0,20}(3|4|5)\+?\s*years/i, label: 'Unrealistic requirements', category: 'growth', severity: 'high' },
    ];

    private greenFlagPatterns: FlagPattern[] = [
        // Flexibility
        { pattern: /remote|work\s*from\s*home|wfh/i, label: 'Remote work available', category: 'flexibility', severity: 'low' },
        { pattern: /flexible\s*(hours|schedule|working)/i, label: 'Flexible schedule', category: 'flexibility', severity: 'low' },
        { pattern: /hybrid/i, label: 'Hybrid work option', category: 'flexibility', severity: 'low' },
        { pattern: /4[- ]?day\s*(work\s*)?week/i, label: '4-day work week', category: 'flexibility', severity: 'low' },
        { pattern: /asynchronous|async\s*work/i, label: 'Async-friendly', category: 'flexibility', severity: 'low' },

        // Benefits
        { pattern: /unlimited\s*(pto|vacation|time\s*off)/i, label: 'Unlimited PTO', category: 'benefits', severity: 'low' },
        { pattern: /mental\s*health/i, label: 'Mental health support', category: 'benefits', severity: 'low' },
        { pattern: /parental\s*leave/i, label: 'Parental leave', category: 'benefits', severity: 'low' },
        { pattern: /401\s*k\s*match/i, label: '401k matching', category: 'benefits', severity: 'low' },
        { pattern: /health\s*insurance/i, label: 'Health insurance', category: 'benefits', severity: 'low' },

        // Compensation
        { pattern: /equity|stock\s*options|rsu/i, label: 'Equity compensation', category: 'compensation', severity: 'low' },
        { pattern: /\$\d{2,3}[,\d]*\s*[-–]\s*\$\d{2,3}[,\d]*/i, label: 'Transparent salary', category: 'compensation', severity: 'low' },
        { pattern: /signing\s*bonus/i, label: 'Signing bonus', category: 'compensation', severity: 'low' },

        // Growth
        { pattern: /professional\s*development|learning\s*budget/i, label: 'Learning opportunities', category: 'growth', severity: 'low' },
        { pattern: /career\s*(growth|path|progression)/i, label: 'Career growth focus', category: 'growth', severity: 'low' },
        { pattern: /mentorship/i, label: 'Mentorship program', category: 'growth', severity: 'low' },
        { pattern: /promote\s*from\s*within/i, label: 'Internal promotions', category: 'growth', severity: 'low' },

        // Culture
        { pattern: /work[- ]?life\s*balance/i, label: 'Work-life balance focus', category: 'culture', severity: 'low' },
        { pattern: /diverse|diversity|dei|inclusive/i, label: 'DEI commitment', category: 'culture', severity: 'low' },
    ];

    /**
     * Analyze text for red and green flags
     */
    analyze(text: string): { redFlags: Flag[]; greenFlags: Flag[] } {
        const redFlags = this.findFlags(text, this.redFlagPatterns);
        const greenFlags = this.findFlags(text, this.greenFlagPatterns);

        return { redFlags, greenFlags };
    }

    /**
     * Find flags matching patterns in text
     */
    private findFlags(text: string, patterns: FlagPattern[]): Flag[] {
        const flags: Flag[] = [];
        const sentences = this.splitIntoSentences(text);

        for (const pattern of patterns) {
            for (const sentence of sentences) {
                if (pattern.pattern.test(sentence)) {
                    // Check if we already have this flag
                    if (!flags.some((f) => f.keyword === pattern.label)) {
                        flags.push({
                            keyword: pattern.label,
                            context: sentence.trim().substring(0, 200), // Limit context length
                            severity: pattern.severity,
                            category: pattern.category,
                        });
                    }
                    break; // Only match once per pattern
                }
            }
        }

        return flags;
    }

    /**
     * Split text into sentences for context extraction
     */
    private splitIntoSentences(text: string): string[] {
        // Remove HTML tags
        const cleanText = text.replace(/<[^>]*>/g, ' ');
        // Split by sentence endings or bullet points
        return cleanText.split(/[.!?•\n]+/).filter((s) => s.trim().length > 0);
    }
}
