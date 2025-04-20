/**
 * Background Service Worker
 * Handles extension-wide events, message passing, and persistent storage
 *
 * KEY DESIGN DECISION: No external server dependencies.
 * - AI calls go directly from the extension to OpenAI/Anthropic using the
 *   user's API key stored in chrome.storage.sync
 * - Job data is stored entirely in chrome.storage (sync + local fallback)
 * - No localhost proxy, no Next.js backend needed
 */

import type { JobData } from '@job-bodyguard/types';

// Message types for internal communication
export type MessageType =
    | 'JOB_DATA_EXTRACTED'
    | 'REQUEST_ANALYSIS'
    | 'ANALYSIS_COMPLETE'
    | 'REQUEST_TAILOR'
    | 'TAILOR_COMPLETE'
    | 'SAVE_APPLICATION'
    | 'OPEN_SIDEPANEL'
    | 'GET_CURRENT_JOB'
    | 'SAVE_TO_DASHBOARD'
    | 'GET_SAVED_JOBS'
    | 'DELETE_JOB'
    | 'GET_SETTINGS'
    | 'SAVE_SETTINGS';

export interface ExtensionMessage<T = unknown> {
    type: MessageType;
    payload: T;
    timestamp: number;
}

export interface SavedJob extends JobData {
    id: string;
    savedAt: string;
    status: 'saved' | 'applied' | 'interview' | 'rejected' | 'offer';
    notes?: string;
}

export interface ExtensionSettings {
    apiKey: string;
    apiProvider: 'openai' | 'anthropic' | 'custom';
    customApiUrl: string;
    customPrompt: string;
    resumeText: string;
}

// Store current job data in memory
let currentJobData: JobData | null = null;

// Listen for messages from content scripts and popup/sidepanel
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    console.log('[Background] Received message:', message.type);

    switch (message.type) {
        case 'JOB_DATA_EXTRACTED':
            currentJobData = (message.payload as JobData) ?? null;
            // Write to storage so popup's onChanged listener fires immediately
            if (currentJobData) {
                chrome.storage.local.set({ currentJob: currentJobData });
            } else {
                // null = user navigated away from job page → clear stale data
                chrome.storage.local.remove('currentJob');
            }
            sendResponse({ success: true });
            break;

        case 'GET_CURRENT_JOB':
            // Return from memory first, then storage
            if (currentJobData) {
                sendResponse({ success: true, data: currentJobData });
            } else {
                chrome.storage.local.get('currentJob', (result) => {
                    currentJobData = result.currentJob || null;
                    sendResponse({ success: true, data: currentJobData });
                });
                return true;
            }
            break;

        case 'OPEN_SIDEPANEL':
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tabId = tabs[0]?.id;
                if (tabId) {
                    chrome.sidePanel.open({ tabId }).catch(err => {
                        console.error('[Background] Failed to open sidepanel:', err);
                    });
                }
            });
            sendResponse({ success: true });
            break;

        case 'SAVE_TO_DASHBOARD':
            console.log('[Background] SAVE_TO_DASHBOARD received');
            handleSaveJob(message.payload as JobData)
                .then((result) => {
                    console.log('[Background] Job saved successfully:', result.title);
                    sendResponse({ success: true, data: result });
                })
                .catch((error: Error) => {
                    console.error('[Background] Failed to save job:', error);
                    sendResponse({ success: false, error: error.message });
                });
            return true; // Keep channel open for async response

        case 'GET_SAVED_JOBS':
            handleGetSavedJobs()
                .then((jobs) => sendResponse({ success: true, data: jobs }))
                .catch((error: Error) => sendResponse({ success: false, error: error.message }));
            return true;

        case 'DELETE_JOB':
            handleDeleteJob(message.payload as string)
                .then(() => sendResponse({ success: true }))
                .catch((error: Error) => sendResponse({ success: false, error: error.message }));
            return true;

        case 'GET_SETTINGS':
            chrome.storage.sync.get('settings', (result) => {
                sendResponse({ success: true, data: result.settings || getDefaultSettings() });
            });
            return true;

        case 'SAVE_SETTINGS':
            chrome.storage.sync.set({ settings: message.payload }, () => {
                sendResponse({ success: true });
            });
            return true;

        case 'REQUEST_ANALYSIS':
            // Direct AI call — no proxy server needed
            handleAnalysisRequest(message.payload as JobData)
                .then((result: unknown) => sendResponse({ success: true, data: result }))
                .catch((error: Error) => sendResponse({ success: false, error: error.message }));
            return true;

        default:
            sendResponse({ success: false, error: 'Unknown message type' });
    }

    return true;
});

// ─── Settings ───────────────────────────────────────────────

function getDefaultSettings(): ExtensionSettings {
    return {
        apiKey: '',
        apiProvider: 'openai',
        customApiUrl: '',
        customPrompt: '',
        resumeText: '',
    };
}

async function getSettings(): Promise<ExtensionSettings> {
    const result = await chrome.storage.sync.get('settings');
    return result.settings || getDefaultSettings();
}

// ─── Job Storage ─────────────────────────────────────────────

async function handleSaveJob(jobData: JobData): Promise<SavedJob> {
    const jobs = await handleGetSavedJobs();

    // Check if job already exists (by URL)
    const existingIndex = jobData.url
        ? jobs.findIndex((j: SavedJob) => j.url === jobData.url)
        : -1;

    const newJob: SavedJob = {
        ...jobData,
        id: existingIndex >= 0 ? jobs[existingIndex].id : crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        status: existingIndex >= 0 ? jobs[existingIndex].status : 'saved',
    };

    if (existingIndex >= 0) {
        jobs[existingIndex] = newJob;
    } else {
        jobs.unshift(newJob);
    }

    // Keep last 100 jobs
    const trimmed = jobs.slice(0, 100);

    await saveJobsToStorage(trimmed);

    console.log('[Background] Job saved:', newJob.title, '| Total:', trimmed.length);
    return newJob;
}

async function handleGetSavedJobs(): Promise<SavedJob[]> {
    // Try sync storage first (available across devices)
    try {
        const syncResult = await chrome.storage.sync.get('savedJobs');
        if (syncResult.savedJobs?.length > 0) {
            return syncResult.savedJobs;
        }
    } catch (e) {
        console.warn('[Background] Sync read failed:', e);
    }

    // Fallback to local storage
    const localResult = await chrome.storage.local.get('savedJobs');
    return localResult.savedJobs || [];
}

async function saveJobsToStorage(jobs: SavedJob[]): Promise<void> {
    try {
        await chrome.storage.sync.set({ savedJobs: jobs });
    } catch (e) {
        // sync storage quota exceeded — fall back to local
        console.warn('[Background] Sync quota exceeded, using local storage');
        await chrome.storage.local.set({ savedJobs: jobs });
    }
}

async function handleDeleteJob(jobId: string): Promise<void> {
    const jobs = await handleGetSavedJobs();
    const filtered = jobs.filter(j => j.id !== jobId);
    await saveJobsToStorage(filtered);
    console.log('[Background] Job deleted:', jobId);
}

// ─── AI Analysis — Direct Browser-to-API ────────────────────

const ANALYSIS_SYSTEM_PROMPT = `You are "Job Decoder" — a sarcastic but insightful career advisor.
Analyze job postings and identify red flags, green flags, and provide honest feedback.
Be witty but genuinely helpful. Always respond with valid JSON matching the exact schema requested.`;

async function handleAnalysisRequest(jobData: JobData): Promise<unknown> {
    const settings = await getSettings();

    if (!settings.apiKey) {
        throw new Error('No API key configured. Please go to Settings to add your OpenAI/Anthropic API key.');
    }

    const resumeSection = settings.resumeText
        ? `\n\n## MY RESUME\n${settings.resumeText}`
        : '';

    const userPrompt = `## JOB POSTING

Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location || 'Not specified'}

Description:
${jobData.description.substring(0, 4000)}

${resumeSection}

## YOUR TASK

Analyze this job posting. Return a JSON object with:
{
  "roast": "Sarcastic 2-3 sentence translation of what this job really means",
  "toxicityScore": number (0-100, higher = more toxic),
  "compatibilityScore": number (0-100, higher = better match with resume),
  "redFlags": [{ "flag": "Brief title", "explanation": "Why this is concerning", "severity": "low|medium|high|critical" }],
  "greenFlags": [{ "flag": "Brief title", "explanation": "Why this is positive" }],
  "gapAnalysis": {
    "missingSkills": ["skill1", "skill2"],
    "suggestions": ["Action to improve your application"]
  },
  "interviewQuestions": ["Question to ask the employer 1", "Question 2", "Question 3"],
  "verdict": "strong_apply|apply|caution|skip",
  "verdictText": "One-line recommendation"
}`;

    try {
        const result = await callAI(settings, ANALYSIS_SYSTEM_PROMPT, userPrompt);
        return result;
    } catch (error) {
        console.error('[Background] AI call failed:', error);
        // Re-throw with a clean message — don't silently fall back to fake data
        throw error;
    }
}

/**
 * Resolve a full /chat/completions URL from a base URL.
 * Handles cases where user pastes just https://openrouter.ai/api/v1 (without the path).
 */
function resolveApiUrl(base: string): string {
    const trimmed = base.replace(/\/+$/, '');
    if (trimmed.endsWith('/chat/completions')) return trimmed;
    return `${trimmed}/chat/completions`;
}

/**
 * Parse an API response, detecting HTML error pages before attempting JSON.parse.
 * This gives clear error messages instead of "Unexpected token '<'".
 */
async function parseApiResponse(response: Response): Promise<unknown> {
    const text = await response.text();

    // HTML response = wrong URL or server error page
    if (text.trimStart().startsWith('<')) {
        throw new Error(
            `API returned an HTML page (HTTP ${response.status}). ` +
            `Your Custom API URL may be wrong — try adding /chat/completions ` +
            `(e.g. https://openrouter.ai/api/v1/chat/completions).`
        );
    }

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(`API returned invalid JSON (HTTP ${response.status}): ${text.substring(0, 200)}`);
    }

    if (!response.ok) {
        const errMsg =
            (parsed?.error as Record<string, unknown>)?.message as string ||
            parsed?.message as string ||
            text.substring(0, 300);
        throw new Error(`API error ${response.status}: ${errMsg}`);
    }

    return parsed;
}

async function callAI(
    settings: ExtensionSettings,
    systemPrompt: string,
    userPrompt: string
): Promise<unknown> {
    const systemToUse = settings.customPrompt || systemPrompt;

    // ── Anthropic ────────────────────────────────────────────
    if (settings.apiProvider === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': settings.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
                model: 'claude-haiku-20240307',
                max_tokens: 2000,
                system: systemToUse,
                messages: [{ role: 'user', content: userPrompt }],
            }),
        });

        const data = await parseApiResponse(response) as Record<string, unknown>;
        const content = (data.content as Array<{ text: string }>)[0]?.text || '{}';
        return JSON.parse(content);
    }

    // ── OpenAI / OpenRouter / Custom (OpenAI-compatible) ────
    let url: string;
    const extraHeaders: Record<string, string> = {};

    if (settings.apiProvider === 'custom' && settings.customApiUrl) {
        url = resolveApiUrl(settings.customApiUrl);

        // OpenRouter requires these headers to accept requests
        if (url.includes('openrouter.ai')) {
            extraHeaders['HTTP-Referer'] = 'https://job-bodyguard.app';
            extraHeaders['X-Title'] = 'Job Bodyguard';
        }
    } else {
        url = 'https://api.openai.com/v1/chat/completions';
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
            ...extraHeaders,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemToUse },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 2000,
        }),
    });

    const data = await parseApiResponse(response) as Record<string, unknown>;
    const choices = data.choices as Array<{ message: { content: string } }>;
    const content = choices[0]?.message?.content || '{}';
    return JSON.parse(content);
}

// ─── Extension Setup ──────────────────────────────────────────

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const isJobPage =
            tab.url.includes('linkedin.com/jobs') ||
            tab.url.includes('indeed.com/viewjob') ||
            tab.url.includes('indeed.com/rc/clk') ||
            tab.url.includes('indeed.com/jobs') ||
            /indeed\.com\/.*[?&](vjk|jk)=/.test(tab.url) ||
            tab.url.includes('hh.ru/vacancy');

        if (isJobPage) {
            chrome.sidePanel.setOptions({
                tabId,
                path: 'sidepanel.html',
                enabled: true,
            });
        }
    }
});

console.log('[Job Bodyguard] Background service worker started (serverless mode)');
