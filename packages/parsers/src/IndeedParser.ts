import type { JobData } from '@job-bodyguard/types';
import { BaseParser } from './BaseParser';

/**
 * Parser for Indeed job postings
 * Handles: indeed.com/viewjob*, indeed.com/rc/clk/*
 */
export class IndeedParser extends BaseParser {
    platform = 'indeed' as const;

    private static URL_PATTERNS = [
        /indeed\.com\/viewjob/,
        /indeed\.com\/rc\/clk/,
        /indeed\.com\/jobs/,
    ];

    // Using data-testid attributes for stability
    private selectors = {
        title: 'h1.jobsearch-JobInfoHeader-title, [data-testid="jobsearch-JobInfoHeader-title"], h2.jobTitle',
        company: '[data-testid="company-name"], .jobsearch-InlineCompanyRating-companyHeader',
        location: '[data-testid="text-location"], [data-testid="job-location"]',
        description: '#jobDescriptionText, [data-testid="jobDescriptionText"]',
        salary: '[data-testid="attribute_snippet_testid"], .jobsearch-JobMetadataHeader-item',
        posted: '[data-testid="myJobsStateDate"], .jobsearch-HiringInsights-entry--text',
    };

    matchesUrl(url: string): boolean {
        return IndeedParser.URL_PATTERNS.some((pattern) => pattern.test(url));
    }

    async extractJobData(document: Document): Promise<JobData> {
        const url = document.location?.href || '';
        const jobData = this.createEmptyJobData(url);

        // 1. Extract visible data
        jobData.title = this.getText(document, this.selectors.title);
        jobData.company = this.getText(document, this.selectors.company);
        jobData.location = this.getText(document, this.selectors.location);
        jobData.description = this.getHtml(document, this.selectors.description);

        // 2. Try to find salary
        const salaryEls = document.querySelectorAll(this.selectors.salary);
        for (const el of salaryEls) {
            const text = el.textContent || '';
            if (text.includes('$') || text.includes('€') || text.includes('£') || text.includes('a year') || text.includes('an hour')) {
                jobData.visibleSalary = text.trim();
                break;
            }
        }

        // 3. Try to parse "Posted X days ago" text
        const postedAge = this.parsePostedText(document);
        if (postedAge !== null) {
            jobData.jobAge = postedAge;
            // Calculate approximate datePosted
            const date = new Date();
            date.setDate(date.getDate() - postedAge);
            jobData.datePosted = date.toISOString().split('T')[0];
        }

        // 4. Extract JSON-LD if available
        const jsonLd = this.extractJsonLd(document);
        if (jsonLd) {
            if (jsonLd.datePosted) {
                jobData.datePosted = String(jsonLd.datePosted);
                jobData.jobAge = this.calculateDaysAgo(jobData.datePosted);
            }

            if (jsonLd.validThrough) {
                jobData.validThrough = String(jsonLd.validThrough);
            }

            // Extract salary from JSON-LD
            const baseSalary = jsonLd.baseSalary as Record<string, unknown> | undefined;
            if (baseSalary) {
                const salaryValue = baseSalary.value as Record<string, unknown> | undefined;
                if (salaryValue) {
                    jobData.hiddenSalary = {
                        min: (salaryValue.minValue as number) || null,
                        max: (salaryValue.maxValue as number) || null,
                        currency: (baseSalary.currency as string) || 'USD',
                        period: this.mapSalaryPeriod(salaryValue.unitText as string),
                    };
                }
            }
        }

        return jobData;
    }

    /**
     * Parse "Posted X days ago" text
     */
    private parsePostedText(doc: Document): number | null {
        const postedEl = doc.querySelector(this.selectors.posted);
        const text = postedEl?.textContent || '';

        // "Posted 5 days ago"
        const daysMatch = text.match(/(\d+)\s*days?\s*ago/i);
        if (daysMatch) {
            return parseInt(daysMatch[1], 10);
        }

        // "Just posted" or "Today"
        if (text.toLowerCase().includes('just posted') || text.toLowerCase().includes('today')) {
            return 0;
        }

        // "Posted 30+ days ago"
        const plusMatch = text.match(/(\d+)\+\s*days?\s*ago/i);
        if (plusMatch) {
            return parseInt(plusMatch[1], 10);
        }

        return null;
    }
}
