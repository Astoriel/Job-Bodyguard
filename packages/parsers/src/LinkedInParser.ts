import type { JobData, SalaryData } from '@job-bodyguard/types';
import { BaseParser } from './BaseParser';

/**
 * Parser for LinkedIn job postings.
 * Handles TWO URL patterns:
 * Handles ALL URL patterns:
 *  - /jobs/view/slug-title-123456 (direct job link, with slug)
 *  - /jobs/search/?currentJobId=123456 (split-pane search view — most common!)
 *  - /jobs/recommended/?currentJobId=123456 (recommended jobs view)
 *  - /jobs/collections/some-collection/?currentJobId=123456 (collections view)
 *  - /jobs/?currentJobId=123456 (regional root /jobs/ with ID)
 */
export class LinkedInParser extends BaseParser {
    platform = 'linkedin' as const;

    // All LinkedIn URL patterns that show a job detail panel
    private static VIEW_PATTERN = /linkedin\.com\/jobs\/view\/([^/?#]+)/;
    private static SEARCH_PATTERN = /linkedin\.com\/jobs\/(?:search|recommended|collections)\/.*[?&]currentJobId=(\d+)/;
    // Some regional sites use /jobs/ root with currentJobId
    private static ROOT_JOB_PATTERN = /linkedin\.com\/jobs[/?].*[?&]currentJobId=(\d+)/;

    private selectors = {
        title: [
            // Logged-in view
            '.job-details-jobs-unified-top-card__job-title h1',
            '.job-details-jobs-unified-top-card__job-title',
            '.jobs-unified-top-card__job-title',
            'h1.t-24',
            '.jobs-details-top-card__job-title',
            // Public / guest view (ca.linkedin.com, fr.linkedin.com, etc.)
            'h1.top-card-layout__title',
            '.top-card-layout__title',
            'h1',
        ].join(', '),

        company: [
            // Logged-in view
            '.job-details-jobs-unified-top-card__company-name a',
            '.jobs-unified-top-card__company-name a',
            '.jobs-unified-top-card__company-name',
            '.job-details-jobs-unified-top-card__primary-description-without-tagline a',
            '.jobs-details-top-card__company-url',
            // Public / guest view
            '.topcard__org-name-link',
            '.topcard__flavor--black-link',
            'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
        ].join(', '),

        location: [
            // Logged-in view
            '.job-details-jobs-unified-top-card__bullet',
            '.jobs-unified-top-card__bullet',
            '.jobs-unified-top-card__workplace-type',
            '.job-details-jobs-unified-top-card__primary-description span',
            // Public / guest view
            '.topcard__flavor--bullet',
            '.topcard__flavor',
        ].join(', '),

        description: [
            // Logged-in view
            '#job-details',
            '.jobs-description__content',
            '.jobs-box__html-content',
            '.jobs-description-content__text',
            // Public / guest view
            '.description__text',
            '.show-more-less-html',
            '[class*="description"] [class*="content"]',
        ].join(', '),

        salary: [
            // Logged-in view
            '.job-details-jobs-unified-top-card__job-insight span',
            // Public / guest view
            '.compensation__salary',
            '.salary',
            '[class*="compensation"] [class*="salary"]',
        ].join(', '),
    };

    matchesUrl(url: string): boolean {
        return (
            LinkedInParser.VIEW_PATTERN.test(url) ||
            LinkedInParser.SEARCH_PATTERN.test(url) ||
            LinkedInParser.ROOT_JOB_PATTERN.test(url)
        );
    }

    /** Extract the numeric job ID from the current URL */
    private extractJobId(url: string): string | null {
        // Search/collections split-pane: currentJobId=12345
        const searchMatch = LinkedInParser.SEARCH_PATTERN.exec(url) ||
            LinkedInParser.ROOT_JOB_PATTERN.exec(url);
        if (searchMatch) return searchMatch[1];

        // Direct view: /jobs/view/12345/ or /jobs/view/slug-title-12345
        const viewMatch = LinkedInParser.VIEW_PATTERN.exec(url);
        if (viewMatch) {
            const slug = viewMatch[1];
            // Slug may be "data-scientist-at-company-4376351830" — extract trailing digits
            const trailingDigits = slug.match(/(\d+)\/?$/);
            return trailingDigits ? trailingDigits[1] : slug;
        }

        return null;
    }

    async extractJobData(document: Document): Promise<JobData> {
        const url = document.location?.href || '';
        const jobData = this.createEmptyJobData(url);

        // 1. Extract visible data (DOM selectors)
        jobData.title = this.getText(document, this.selectors.title);
        jobData.company = this.getText(document, this.selectors.company);
        jobData.location = this.getText(document, this.selectors.location);
        jobData.description = this.getHtml(document, this.selectors.description);

        // 2. Try to find visible salary
        const salaryEls = document.querySelectorAll(this.selectors.salary);
        for (const el of salaryEls) {
            const text = el.textContent || '';
            if (text.includes('$') || text.includes('€') || text.includes('£') || text.match(/\d{2,}[kK]/)) {
                jobData.visibleSalary = text.trim();
                break;
            }
        }

        // 3. Extract JSON-LD metadata (most reliable source for salary, dates)
        const jsonLd = this.extractJsonLd(document);
        if (jsonLd) {
            if (jsonLd.datePosted) {
                jobData.datePosted = String(jsonLd.datePosted);
                jobData.jobAge = this.calculateDaysAgo(jobData.datePosted);
            }
            if (jsonLd.validThrough) {
                jobData.validThrough = String(jsonLd.validThrough);
            }
            // Title/company from JSON-LD as fallback
            if (!jobData.title && jsonLd.title) {
                jobData.title = String(jsonLd.title);
            }
            if (!jobData.company) {
                const org = jsonLd.hiringOrganization as Record<string, unknown> | undefined;
                if (org?.name) jobData.company = String(org.name);
            }

            const baseSalary = jsonLd.baseSalary as Record<string, unknown> | undefined;
            if (baseSalary) {
                const salaryValue = baseSalary.value as Record<string, unknown> | number | undefined;
                if (typeof salaryValue === 'object' && salaryValue) {
                    jobData.hiddenSalary = {
                        min: (salaryValue.minValue as number) || null,
                        max: (salaryValue.maxValue as number) || null,
                        currency: (baseSalary.currency as string) || 'EUR',
                        period: this.mapSalaryPeriod(salaryValue.unitText as string),
                    };
                } else if (typeof salaryValue === 'number') {
                    jobData.hiddenSalary = {
                        min: salaryValue,
                        max: salaryValue,
                        currency: (baseSalary.currency as string) || 'EUR',
                        period: 'YEAR',
                    };
                }
            }
        }

        // 4. Detect salary mismatch
        if (jobData.hiddenSalary && !jobData.visibleSalary) {
            jobData.salaryMismatch = true;
        }

        // 5. Tag with jobId for deduplication
        const jobId = this.extractJobId(url);
        if (jobId) {
            jobData.url = `https://www.linkedin.com/jobs/view/${jobId}/`;
        }

        return jobData;
    }
}
