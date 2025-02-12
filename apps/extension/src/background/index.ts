/**
 * Background Service Worker
 * Handles extension-wide events and message passing
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
    | 'GET_CURRENT_JOB';

export interface ExtensionMessage<T = unknown> {
    type: MessageType;
    payload: T;
    timestamp: number;
}

// Store current job data in memory
let currentJobData: JobData | null = null;

// Listen for messages from content scripts and popup/sidepanel
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    console.log('[Background] Received message:', message.type);

    switch (message.type) {
        case 'JOB_DATA_EXTRACTED':
            // Store job data from content script
            currentJobData = message.payload as JobData;
            // Store in chrome.storage for persistence
            chrome.storage.local.set({ currentJob: currentJobData });
            sendResponse({ success: true });
            break;

        case 'GET_CURRENT_JOB':
            // Return current job data
            sendResponse({ success: true, data: currentJobData });
            break;

        case 'OPEN_SIDEPANEL':
            // Open side panel for the current tab
            if (sender.tab?.windowId) {
                chrome.sidePanel.open({ windowId: sender.tab.windowId });
            }
            sendResponse({ success: true });
            break;

        case 'REQUEST_ANALYSIS':
            // TODO: Forward to API
            handleAnalysisRequest(message.payload as JobData)
                .then((result) => sendResponse({ success: true, data: result }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
            return true; // Keep channel open for async response

        default:
            sendResponse({ success: false, error: 'Unknown message type' });
    }

    return true;
});

// Handle analysis request - will call API
async function handleAnalysisRequest(jobData: JobData): Promise<unknown> {
    // Get stored resume
    const { resume } = await chrome.storage.local.get('resume');

    // TODO: Call API endpoint
    // For now, return mock data
    return {
        roast: 'This job posting is a masterclass in corporate doublespeak...',
        toxicityScore: 45,
        compatibilityScore: 72,
        redFlags: [
            { flag: 'Fast-paced environment', explanation: 'Code for "we\'re understaffed"', severity: 'medium' },
        ],
        greenFlags: [
            { flag: 'Remote work', explanation: 'Genuine flexibility', severity: 'low' },
        ],
        gapAnalysis: {
            missingSkills: ['Kubernetes', 'GraphQL'],
            suggestions: ['Add cloud experience to your resume'],
        },
        interviewQuestions: [
            'What does work-life balance look like here?',
            'Why is this position open?',
            'What happened to the last person in this role?',
        ],
        verdict: 'caution',
        verdictText: 'Proceed with caution - some yellow flags but could be worth exploring.',
    };
}

// Set up side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

// Listen for tab updates to detect job pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const isJobPage =
            tab.url.includes('linkedin.com/jobs/view') ||
            tab.url.includes('indeed.com/viewjob') ||
            tab.url.includes('indeed.com/rc/clk');

        if (isJobPage) {
            // Enable side panel for this tab
            chrome.sidePanel.setOptions({
                tabId,
                path: 'sidepanel.html',
                enabled: true,
            });
        }
    }
});

console.log('[Job Bodyguard] Background service worker started');
