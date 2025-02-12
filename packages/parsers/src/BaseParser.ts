import type { JobData, JobPlatform, Flag } from '@job-bodyguard/types';

/**
 * Abstract base class for job parsers
 */
export abstract class BaseParser {
    abstract platform: JobPlatform;

    /**
     * Extract job data from the document
     */
    abstract extractJobData(document: Document): Promise<JobData>;

    /**
     * Check if the current URL matches this parser
     */
    abstract matchesUrl(url: string): boolean;

    /**
     * Safely get text content from a selector
     */
    protected getText(doc: Document, selector: string): string {
        const el = doc.querySelector(selector);
        return el?.textContent?.trim() || '';
    }

    /**
     * Safely get HTML content from a selector
     */
    protected getHtml(doc: Document, selector: string): string {
        const el = doc.querySelector(selector);
        return el?.innerHTML || '';
    }

    /**
     * Calculate days ago from a date string
     */
    protected calculateDaysAgo(dateString: string): number {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    /**
     * Extract JSON-LD data from the page
     */
    protected extractJsonLd(doc: Document): Record<string, unknown> | null {
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

        for (const script of scripts) {
            try {
                const data = JSON.parse(script.textContent || '');

                // Handle array of items
                if (Array.isArray(data)) {
                    const jobPosting = data.find((item) => item['@type'] === 'JobPosting');
                    if (jobPosting) return jobPosting;
                }

                // Handle single item
                if (data['@type'] === 'JobPosting') {
                    return data;
                }

                // Handle @graph format
                if (data['@graph']) {
                    const jobPosting = data['@graph'].find(
                        (item: Record<string, unknown>) => item['@type'] === 'JobPosting'
                    );
                    if (jobPosting) return jobPosting;
                }
            } catch {
                continue;
            }
        }

        return null;
    }

    /**
     * Map salary period text to enum
     */
    protected mapSalaryPeriod(unitText: string | undefined): 'YEAR' | 'MONTH' | 'HOUR' {
        if (!unitText) return 'YEAR';
        const lower = unitText.toLowerCase();
        if (lower.includes('hour')) return 'HOUR';
        if (lower.includes('month')) return 'MONTH';
        return 'YEAR';
    }

    /**
     * Create empty job data object
     */
    protected createEmptyJobData(url: string): JobData {
        return {
            title: '',
            company: '',
            location: '',
            description: '',
            requirements: [],
            datePosted: null,
            validThrough: null,
            jobAge: null,
            visibleSalary: null,
            hiddenSalary: null,
            salaryMismatch: false,
            redFlags: [],
            greenFlags: [],
            url,
            platform: this.platform,
            scrapedAt: new Date().toISOString(),
        };
    }
}
