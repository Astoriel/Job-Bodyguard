/**
 * Flag found in job posting
 */
export interface Flag {
    /** Display label for the flag */
    keyword: string;
    /** Sentence/context where the flag was found */
    context: string;
    /** Severity level */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** Category of concern */
    category: 'culture' | 'workload' | 'management' | 'compensation' | 'growth' | 'flexibility' | 'benefits';
}

/**
 * Salary information extracted from job posting
 */
export interface SalaryData {
    min: number | null;
    max: number | null;
    currency: string;
    period: 'YEAR' | 'MONTH' | 'HOUR';
}

/**
 * Complete job data extracted from a job posting page
 */
export interface JobData {
    // Basic Info
    title: string;
    company: string;
    location: string;
    description: string;
    requirements: string[];

    // Hidden Metadata
    datePosted: string | null;
    validThrough: string | null;
    jobAge: number | null; // days since posted

    // Salary
    visibleSalary: string | null;
    hiddenSalary: SalaryData | null;
    salaryMismatch: boolean;

    // Flags
    redFlags: Flag[];
    greenFlags: Flag[];

    // Meta
    url: string;
    platform: JobPlatform;
    scrapedAt: string;
}

/**
 * Supported job platforms
 */
export type JobPlatform = 'linkedin' | 'indeed' | 'other';
