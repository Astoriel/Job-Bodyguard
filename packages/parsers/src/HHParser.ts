import type { JobData, JobPlatform } from '@job-bodyguard/types';
import { BaseParser } from './BaseParser';

/**
 * Parser for hh.ru job postings
 * HH.ru is the largest job platform in Russia and CIS countries
 */
export class HHParser extends BaseParser {
    readonly platform: JobPlatform = 'other';

    /**
     * Check if current URL is a valid hh.ru job page
     */
    matchesUrl(url: string): boolean {
        const patterns = [
            /^https?:\/\/([\w-]+\.)?hh\.ru\/vacancy\/\d+/,
            /^https?:\/\/([\w-]+\.)?headhunter\.ru\/vacancy\/\d+/
        ];
        return patterns.some(p => p.test(url));
    }

    /**
     * Extract job data from hh.ru vacancy page
     */
    async extractJobData(doc: Document): Promise<JobData> {
        const jsonLd = this.extractHHJsonLd(doc);
        const dom = this.extractFromDOM(doc);

        return {
            title: jsonLd.title || dom.title || 'Unknown Title',
            company: jsonLd.company || dom.company || 'Unknown Company',
            location: jsonLd.location || dom.location || 'Unknown Location',
            description: dom.description || '',
            requirements: this.extractRequirements(dom.description),

            datePosted: jsonLd.datePosted || null,
            validThrough: jsonLd.validThrough || null,
            jobAge: jsonLd.datePosted ? this.calculateDaysAgo(jsonLd.datePosted) : null,

            visibleSalary: dom.salary || null,
            hiddenSalary: this.parseSalary(jsonLd.salary || dom.salary),
            salaryMismatch: false,

            redFlags: [],
            greenFlags: [],

            url: doc.location?.href || '',
            platform: this.platform,
            scrapedAt: new Date().toISOString(),
        };
    }

    /**
     * Extract structured data from JSON-LD script (HH.ru specific)
     */
    protected extractHHJsonLd(doc: Document): {
        title?: string;
        company?: string;
        location?: string;
        datePosted?: string;
        validThrough?: string;
        salary?: string;
    } {
        const data = this.extractJsonLd(doc);
        if (!data) return {};

        return {
            title: data.title as string | undefined,
            company: (data.hiringOrganization as Record<string, unknown>)?.name as string | undefined,
            location: this.extractLocation(data),
            datePosted: data.datePosted as string | undefined,
            validThrough: data.validThrough as string | undefined,
            salary: this.formatSalaryFromJsonLd(data.baseSalary as Record<string, unknown> | undefined),
        };
    }

    /**
     * Extract location from JSON-LD
     */
    private extractLocation(data: Record<string, unknown>): string | undefined {
        const jobLocation = data.jobLocation as Record<string, unknown> | undefined;
        if (!jobLocation) return undefined;

        const address = jobLocation.address as Record<string, unknown> | undefined;
        if (!address) return undefined;

        return (address.addressLocality || address.addressRegion) as string | undefined;
    }

    /**
     * Format salary from JSON-LD structure
     */
    private formatSalaryFromJsonLd(baseSalary?: Record<string, unknown>): string | undefined {
        if (!baseSalary?.value) return undefined;

        const value = baseSalary.value as Record<string, number> | undefined;
        if (!value) return undefined;

        const { minValue, maxValue } = value;
        const currency = (baseSalary.currency || 'RUB') as string;

        if (minValue && maxValue) {
            return `${minValue.toLocaleString()} - ${maxValue.toLocaleString()} ${currency}`;
        }
        if (value.value) {
            return `${value.value.toLocaleString()} ${currency}`;
        }
        return undefined;
    }

    /**
     * Extract data directly from DOM elements
     */
    private extractFromDOM(doc: Document): {
        title: string;
        company: string;
        location: string;
        description: string;
        salary: string | null;
    } {
        // HH.ru specific selectors
        const selectors = {
            title: [
                'h1[data-qa="vacancy-title"]',
                '.vacancy-title h1',
                'h1.bloko-header-section-1',
            ],
            company: [
                '[data-qa="vacancy-company-name"]',
                '.vacancy-company-name a',
                '.bloko-link_kind-tertiary',
            ],
            location: [
                '[data-qa="vacancy-view-location"]',
                '.vacancy-view-location',
                '[data-qa="vacancy-view-raw-address"]',
            ],
            description: [
                '[data-qa="vacancy-description"]',
                '.vacancy-section',
                '.bloko-gap-bottom-6 .g-user-content',
            ],
            salary: [
                '[data-qa="vacancy-salary-compensation-type-net"]',
                '[data-qa="vacancy-salary"]',
                '.vacancy-salary',
                '.bloko-header-section-2',
            ],
        };

        return {
            title: this.findText(doc, selectors.title),
            company: this.findText(doc, selectors.company),
            location: this.findText(doc, selectors.location),
            description: this.findHtml(doc, selectors.description),
            salary: this.findText(doc, selectors.salary) || null,
        };
    }

    /**
     * Find text content using selector array
     */
    private findText(doc: Document, selectors: string[]): string {
        for (const selector of selectors) {
            const el = doc.querySelector(selector);
            if (el?.textContent?.trim()) {
                return el.textContent.trim();
            }
        }
        return '';
    }

    /**
     * Find HTML content using selector array
     */
    private findHtml(doc: Document, selectors: string[]): string {
        for (const selector of selectors) {
            const el = doc.querySelector(selector);
            if (el?.innerHTML?.trim()) {
                return el.innerHTML.trim();
            }
        }
        return '';
    }

    /**
     * Extract requirements from description
     */
    private extractRequirements(description: string): string[] {
        const requirements: string[] = [];

        // Look for requirement sections in Russian
        const reqPatterns = [
            /требования(?:\s+к\s+кандидату)?[:\s]*(.+?)(?=обязанности|условия|мы\s+предлагаем|$)/is,
            /что\s+мы\s+ожидаем[:\s]*(.+?)(?=обязанности|условия|мы\s+предлагаем|$)/is,
            /ключевые\s+навыки[:\s]*(.+?)(?=обязанности|описание|$)/is,
        ];

        for (const pattern of reqPatterns) {
            const match = description.match(pattern);
            if (match?.[1]) {
                const items = match[1].split(/[•\-\*\n]+/)
                    .map(s => s.replace(/<[^>]+>/g, '').trim())
                    .filter(s => s.length > 5 && s.length < 200);

                requirements.push(...items);
            }
        }

        return [...new Set(requirements)].slice(0, 15);
    }

    /**
     * Parse salary string to structured format
     */
    private parseSalary(salary: string | null): JobData['hiddenSalary'] {
        if (!salary) return null;

        const cleanSalary = salary.replace(/\s+/g, ' ').trim();

        // Patterns for Russian salary formats
        const patterns = [
            /(\d[\d\s]*)\s*[-–—]\s*(\d[\d\s]*)\s*(₽|руб|rub|руб\.?|р\.?)/i,
            /от\s*(\d[\d\s]*)\s*(₽|руб|rub|руб\.?|р\.?)/i,
            /до\s*(\d[\d\s]*)\s*(₽|руб|rub|руб\.?|р\.?)/i,
            /(\d[\d\s]*)\s*(₽|руб|rub|руб\.?|р\.?)/i,
        ];

        for (const pattern of patterns) {
            const match = cleanSalary.match(pattern);
            if (match) {
                const parseNum = (s: string) => parseInt(s.replace(/\s/g, ''), 10);

                if (match[2] && match[3]) {
                    return {
                        min: parseNum(match[1]),
                        max: parseNum(match[2]),
                        currency: 'RUB',
                        period: 'MONTH' as const,
                    };
                }

                if (cleanSalary.includes('от')) {
                    return {
                        min: parseNum(match[1]),
                        max: null,
                        currency: 'RUB',
                        period: 'MONTH' as const,
                    };
                }

                if (cleanSalary.includes('до')) {
                    return {
                        min: null,
                        max: parseNum(match[1]),
                        currency: 'RUB',
                        period: 'MONTH' as const,
                    };
                }

                return {
                    min: parseNum(match[1]),
                    max: parseNum(match[1]),
                    currency: 'RUB',
                    period: 'MONTH' as const,
                };
            }
        }

        return null;
    }
}
