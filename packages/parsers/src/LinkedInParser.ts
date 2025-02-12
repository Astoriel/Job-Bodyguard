import type { JobData, SalaryData } from '@job-bodyguard/types';
import { BaseParser } from './BaseParser';

/**
 * Parser for LinkedIn job postings
 * Handles: linkedin.com/jobs/view/*
 */
export class LinkedInParser extends BaseParser {
    platform = 'linkedin' as const;

    private static URL_PATTERN = /linkedin\.com\/jobs\/view\/(\d+)/;

    private selectors = {
        // Main job details - LinkedIn uses these classes
        title: '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.t-24',
        company: '.job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a',
        location: '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet',
        description: '#job-details, .jobs-description__content, .jobs-box__html-content',

        // Salary (if visible)
        salary: '.job-details-jobs-unified-top-card__job-insight span',
    };

    matchesUrl(url: string): boolean {
        return LinkedInParser.URL_PATTERN.test(url);
    }

    async extractJobData(document: Document): Promise<JobData> {
        const url = document.location?.href || '';
        const jobData = this.createEmptyJobData(url);

        // 1. Extract visible data
        jobData.title = this.getText(document, this.selectors.title);
        jobData.company = this.getText(document, this.selectors.company);
        jobData.location = this.getText(document, this.selectors.location);
        jobData.description = this.getHtml(document, this.selectors.description);

        // 2. Try to find visible salary
        const salaryEls = document.querySelectorAll(this.selectors.salary);
        for (const el of salaryEls) {
            const text = el.textContent || '';
            if (text.includes('$') || text.includes('€') || text.includes('£')) {
                jobData.visibleSalary = text.trim();
                break;
            }
        }

        // 3. Extract JSON-LD metadata
        const jsonLd = this.extractJsonLd(document);
        if (jsonLd) {
            // Date posted
            if (jsonLd.datePosted) {
                jobData.datePosted = String(jsonLd.datePosted);
                jobData.jobAge = this.calculateDaysAgo(jobData.datePosted);
            }

            // Valid through
            if (jsonLd.validThrough) {
                jobData.validThrough = String(jsonLd.validThrough);
            }

            // Hidden salary
            const baseSalary = jsonLd.baseSalary as Record<string, unknown> | undefined;
            if (baseSalary) {
                const salaryValue = baseSalary.value as Record<string, unknown> | number | undefined;

                if (typeof salaryValue === 'object' && salaryValue) {
                    jobData.hiddenSalary = {
                        min: (salaryValue.minValue as number) || null,
                        max: (salaryValue.maxValue as number) || null,
                        currency: (baseSalary.currency as string) || 'USD',
                        period: this.mapSalaryPeriod(salaryValue.unitText as string),
                    };
                } else if (typeof salaryValue === 'number') {
                    jobData.hiddenSalary = {
                        min: salaryValue,
                        max: salaryValue,
                        currency: (baseSalary.currency as string) || 'USD',
                        period: 'YEAR',
                    };
                }
            }
        }

        // 4. Detect salary mismatch
        if (jobData.hiddenSalary && !jobData.visibleSalary) {
            jobData.salaryMismatch = true;
        }

        return jobData;
    }
}
