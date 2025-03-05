// Parsers
export { BaseParser } from './BaseParser';
export { LinkedInParser } from './LinkedInParser';
export { IndeedParser } from './IndeedParser';
export { HHParser } from './HHParser';
export { FlagAnalyzer } from './FlagAnalyzer';

// Factory function to get the right parser for a URL
import { LinkedInParser } from './LinkedInParser';
import { IndeedParser } from './IndeedParser';
import { HHParser } from './HHParser';
import { BaseParser } from './BaseParser';

const parsers = [new LinkedInParser(), new IndeedParser(), new HHParser()];

/**
 * Get the appropriate parser for a given URL
 */
export function getParserForUrl(url: string): BaseParser | null {
    for (const parser of parsers) {
        if (parser.matchesUrl(url)) {
            return parser;
        }
    }
    return null;
}

/**
 * Check if we support parsing for a given URL
 */
export function isSupportedUrl(url: string): boolean {
    return parsers.some((parser) => parser.matchesUrl(url));
}
