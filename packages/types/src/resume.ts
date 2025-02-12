/**
 * User's resume data
 */
export interface ResumeData {
    /** Full text of the resume */
    text: string;

    /** Extracted skills */
    skills: string[];

    /** Professional summary */
    summary: string | null;

    /** Work experience entries */
    experience: ExperienceEntry[];

    /** Last updated timestamp */
    updatedAt: string;
}

/**
 * Work experience entry
 */
export interface ExperienceEntry {
    company: string;
    title: string;
    startDate: string;
    endDate: string | null;
    bullets: string[];
}
