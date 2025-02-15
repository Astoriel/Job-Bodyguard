import { JobData, JobPlatform } from './job';
import { AnalysisResult } from './analysis';

/**
 * Application status
 */
export type ApplicationStatus =
    | 'saved'
    | 'applied'
    | 'interviewing'
    | 'offer'
    | 'rejected'
    | 'withdrawn';

/**
 * Saved job application
 */
export interface Application {
    id: string;
    userId: string;

    // Job info
    jobUrl: string;
    jobTitle: string;
    companyName: string;
    location: string | null;
    platform: JobPlatform;

    // Analysis data
    jobData: JobData | null;
    analysisResult: AnalysisResult | null;

    // Resume used
    resumeSnapshot: string | null;
    resumeDiff: object | null;

    // Quick access flags
    redFlags: object[];
    greenFlags: object[];
    toxicityScore: number | null;
    compatibilityScore: number | null;

    // Interview prep
    interviewQuestions: string[];

    // Status
    status: ApplicationStatus;

    // Timestamps
    appliedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
