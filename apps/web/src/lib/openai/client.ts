import OpenAI from 'openai';

// Lazy OpenAI client - only initializes when first used
let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
    if (!openaiClient) {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openaiClient;
}

export const MODEL = 'gpt-4o-mini';

// Legacy export for compatibility
export const openai = {
    get chat() {
        return getOpenAIClient().chat;
    }
};
