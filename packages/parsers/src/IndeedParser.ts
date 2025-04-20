import type { JobData } from '@job-bodyguard/types';
import { BaseParser } from './BaseParser';

/**
 * Parser for Indeed job postings.
 *
 * Indeed uses two URL patterns:
 *   - /viewjob?jk=XXX         — direct job page
 *   - /jobs?...&vjk=XXX       — split-pane search (right panel updates via Ajax, URL only changes the vjk param)
 *
 * Selectors are scoped to the right-panel container to avoid
 * picking up data from the left-side job cards list.
 */
export class IndeedParser extends BaseParser {
    platform = 'indeed' as const;

    private static URL_PATTERNS = [
        /indeed\.com\/(m\/)?viewjob/,
        /indeed\.com\/rc\/clk/,
        /indeed\.com\/(m\/)?jobs/,
        /indeed\.com\/pagead/,
        /indeed\.com\/.*vjk=/,  // split-pane with vjk= param (e.g. /?vjk=..., /jobs?...&vjk=...)
        /indeed\.com\/.*[?&]jk=/, // direct job link with jk= param
    ];

    // ── Panel container (scope all queries inside this) ──────
    // On the split-pane search view the job detail sits inside one of these
    private PANEL_SELECTORS = [
        // Embedded split-pane (fr.indeed.com/?vjk=... or /jobs?...&vjk=...)
        '.jobsearch-ViewJobLayout--embedded',
        // Direct job page
        '#viewJobSSRRoot',
        '.jobsearch-ViewJobLayout',
        // Fallback containers
        '.jobsearch-JobComponent',
        '[data-testid="JobComponent"]',
    ].join(', ');

    // ── Field selectors (tried in order, first match wins) ───
    private selectors = {
        title: [
            // Most specific — shared between viewjob, split-pane, and mobile
            '[data-testid="jobsearch-JobInfoHeader-title"]',
            'h1.jobsearch-JobInfoHeader-title',
            // Split-pane embedded panel title (not always h1)
            '.jobsearch-ViewJobLayout--embedded [class*="jobTitle"]',
            '.jobsearch-ViewJobLayout--embedded h1',
            '.jobsearch-ViewJobLayout--embedded h2',
            // Very last resort inside the scoped panel
            'h1[class*="title"]',
        ].join(', '),

        company: [
            '[data-testid="inlineHeader-companyName"]',
            '[data-testid="company-name"]',
            '[data-testid="inline-companyname"]',
            '[class*="companyName"] a',
            '[class*="companyName"]',
            'a[href*="/cmp/"]',
            '[class*="company"]',
        ].join(', '),

        location: [
            '[data-testid="inlineHeader-companyLocation"]',
            '[data-testid="text-location"]',
            '[data-testid="job-location"]',
            '[class*="companyLocation"]',
        ].join(', '),

        description: [
            '#jobDescriptionText',
            '[data-testid="jobDescriptionText"]',
            '[id*="jobDescription"]',
            '[class*="jobDescriptionText"]',
        ].join(', '),

        salary: [
            '[data-testid="attribute_snippet_testid"]',
            '[data-testid="jobdetails-salary-info"]',
            '.jobsearch-JobMetadataHeader-item',
            '[class*="salary"]',
        ].join(', '),

        posted: [
            '[data-testid="myJobsStateDate"]',
            '[class*="date"]',
            '.jobsearch-HiringInsights-entry--text',
            '[class*="HiringInsights"]',
        ].join(', '),
    };

    matchesUrl(url: string): boolean {
        return IndeedParser.URL_PATTERNS.some((p) => p.test(url));
    }

    async extractJobData(document: Document): Promise<JobData> {
        const url = document.location?.href || '';
        const jobData = this.createEmptyJobData(url);

        // Try to scope queries to the job detail panel first
        // (to avoid matching job cards in the search results list)
        const scope: Document | Element =
            document.querySelector(this.PANEL_SELECTORS) ?? document;

        // 1. Visible fields
        jobData.title = this.getTextFrom(scope, this.selectors.title);
        jobData.company = this.getTextFrom(scope, this.selectors.company);
        jobData.location = this.getTextFrom(scope, this.selectors.location);
        jobData.description = this.getHtmlFrom(scope, this.selectors.description);

        // 2. Salary
        const salaryEls = scope.querySelectorAll(this.selectors.salary);
        for (const el of salaryEls) {
            const text = el.textContent || '';
            if (
                text.includes('$') || text.includes('€') || text.includes('£') ||
                text.match(/\d[\d\s,]+[kK]/) ||
                text.match(/an? (year|month|hour|heure|an)/i)
            ) {
                jobData.visibleSalary = text.trim();
                break;
            }
        }

        // 3. Posted age from visible text
        const postedAge = this.parsePostedText(scope);
        if (postedAge !== null) {
            jobData.jobAge = postedAge;
            const d = new Date();
            d.setDate(d.getDate() - postedAge);
            jobData.datePosted = d.toISOString().split('T')[0];
        }

        // 4. JSON-LD (most authoritative source for salary + dates)
        const jsonLd = this.extractJsonLd(document);
        if (jsonLd) {
            if (jsonLd.datePosted) {
                jobData.datePosted = String(jsonLd.datePosted);
                jobData.jobAge = this.calculateDaysAgo(jobData.datePosted);
            }
            if (jsonLd.validThrough) {
                jobData.validThrough = String(jsonLd.validThrough);
            }
            // Title / company fallback
            if (!jobData.title && jsonLd.title) jobData.title = String(jsonLd.title);
            if (!jobData.company) {
                const org = jsonLd.hiringOrganization as Record<string, unknown> | undefined;
                if (org?.name) jobData.company = String(org.name);
            }

            const baseSalary = jsonLd.baseSalary as Record<string, unknown> | undefined;
            if (baseSalary) {
                const sv = baseSalary.value as Record<string, unknown> | undefined;
                if (sv) {
                    jobData.hiddenSalary = {
                        min: (sv.minValue as number) || null,
                        max: (sv.maxValue as number) || null,
                        currency: (baseSalary.currency as string) || 'EUR',
                        period: this.mapSalaryPeriod(sv.unitText as string),
                    };
                }
            }
        }

        if (jobData.hiddenSalary && !jobData.visibleSalary) {
            jobData.salaryMismatch = true;
        }

        return jobData;
    }

    // ── Scoped helpers ────────────────────────────────────────

    private getTextFrom(scope: Document | Element, selector: string): string {
        const raw = scope.querySelector(selector)?.textContent?.trim() || '';
        // Indeed appends " - job post" suffix in the data-testid title element
        return raw.replace(/\s*-\s*job\s*post\s*$/i, '').trim();
    }

    private getHtmlFrom(scope: Document | Element, selector: string): string {
        return scope.querySelector(selector)?.innerHTML?.trim() || '';
    }

    // ── "Posted X days ago" parser (French + English) ─────────
    private parsePostedText(scope: Document | Element): number | null {
        const el = scope.querySelector(this.selectors.posted);
        const text = el?.textContent || '';

        // English: "Posted 5 days ago" | "30+ days ago"
        const daysMatch = text.match(/(\d+)\+?\s*days?\s*ago/i);
        if (daysMatch) return parseInt(daysMatch[1], 10);

        // French: "il y a 5 jours" | "il y a 30+ jours"
        const frMatch = text.match(/il\s+y\s+a\s+(\d+)\+?\s*jours?/i);
        if (frMatch) return parseInt(frMatch[1], 10);

        // "Just posted" / "Today" / "Aujourd'hui"
        if (/just posted|today|aujourd/i.test(text)) return 0;

        return null;
    }
}
