import { Flag } from './job';

/**
 * Gap analysis result from AI
 */
export interface GapAnalysis {
    missingSkills: string[];
    suggestions: string[];
}

/**
 * Individual red flag from AI analysis
 */
export interface AnalyzedRedFlag {
    flag: string;
    explanation: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Individual green flag from AI analysis
 */
export interface AnalyzedGreenFlag {
    flag: string;
    explanation: string;
}

/**
 * AI analysis result for a job posting
 */
export interface AnalysisResult {
    /** Sarcastic "translation" of the job posting */
    roast: string;

    /** Toxicity score 0-100 (0 = dream job, 100 = run away) */
    toxicityScore: number;

    /** Compatibility score 0-100 based on resume match */
    compatibilityScore: number;

    /** AI-identified red flags */
    redFlags: AnalyzedRedFlag[];

    /** AI-identified green flags */
    greenFlags: AnalyzedGreenFlag[];

    /** Resume gap analysis */
    gapAnalysis: GapAnalysis;

    /** Questions to ask the recruiter */
    interviewQuestions: string[];

    /** Overall verdict */
    verdict: 'strong_apply' | 'apply' | 'caution' | 'skip';

    /** Human-readable verdict explanation */
    verdictText: string;
}

/**
 * Tailored bullet point from resume
 */
export interface TailoredBullet {
    original: string;
    tailored: string;
    reasoning: string;
}

/**
 * Result of resume tailoring
 */
export interface TailorResult {
    summary: string;
    bullets: TailoredBullet[];
    keywordsAdded: string[];
    fullResume: string;
}
