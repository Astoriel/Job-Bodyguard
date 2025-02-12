/**
 * Content Script Entry Point
 * Runs on job posting pages (LinkedIn, Indeed)
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { getParserForUrl, FlagAnalyzer } from '@job-bodyguard/parsers';
import type { JobData } from '@job-bodyguard/types';
import { FloatingBanner } from './FloatingBanner';

// Prevent multiple injections
if (!(window as unknown as { __JOB_BODYGUARD_INJECTED__: boolean }).__JOB_BODYGUARD_INJECTED__) {
    (window as unknown as { __JOB_BODYGUARD_INJECTED__: boolean }).__JOB_BODYGUARD_INJECTED__ = true;

    console.log('[Job Bodyguard] Content script loaded');

    // Wait for page to be ready
    setTimeout(initContentScript, 1500);
}

async function initContentScript() {
    const url = window.location.href;
    const parser = getParserForUrl(url);

    if (!parser) {
        console.log('[Job Bodyguard] No parser found for this URL');
        return;
    }

    console.log(`[Job Bodyguard] Using ${parser.platform} parser`);

    try {
        // Extract job data
        let jobData = await parser.extractJobData(document);

        // Analyze flags
        const flagAnalyzer = new FlagAnalyzer();
        const { redFlags, greenFlags } = flagAnalyzer.analyze(jobData.description);

        jobData = {
            ...jobData,
            redFlags: [...jobData.redFlags, ...redFlags],
            greenFlags: [...jobData.greenFlags, ...greenFlags],
        };

        console.log('[Job Bodyguard] Extracted job data:', jobData);

        // Send to background script
        chrome.runtime.sendMessage({
            type: 'JOB_DATA_EXTRACTED',
            payload: jobData,
            timestamp: Date.now(),
        });

        // Inject floating banner
        injectBanner(jobData);

    } catch (error) {
        console.error('[Job Bodyguard] Error extracting job data:', error);
    }
}

function injectBanner(jobData: JobData) {
    // Create container with Shadow DOM for style isolation
    const container = document.createElement('div');
    container.id = 'job-bodyguard-banner';
    document.body.appendChild(container);

    const shadowRoot = container.attachShadow({ mode: 'open' });

    // Create React mount point
    const mountPoint = document.createElement('div');
    shadowRoot.appendChild(mountPoint);

    // Inject styles into shadow DOM
    const styles = document.createElement('style');
    styles.textContent = getBannerStyles();
    shadowRoot.appendChild(styles);

    // Render React component
    const root = createRoot(mountPoint);

    const handleAnalyze = () => {
        chrome.runtime.sendMessage({
            type: 'OPEN_SIDEPANEL',
            payload: null,
            timestamp: Date.now(),
        });
    };

    const handleClose = () => {
        container.remove();
    };

    root.render(
        <FloatingBanner
            jobData={jobData}
            onAnalyze={handleAnalyze}
            onClose={handleClose}
        />
    );
}

function getBannerStyles(): string {
    return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    }
    
    .jb-banner {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(10px);
      animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .jb-banner__content {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    
    .jb-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }
    
    .jb-badge--age {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    
    .jb-badge--age.old {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    
    .jb-badge--salary {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    
    .jb-badge--red {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    
    .jb-badge--green {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    
    .jb-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .jb-btn--primary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }
    
    .jb-btn--primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.5);
    }
    
    .jb-btn--ghost {
      background: transparent;
      color: #9ca3af;
      padding: 6px;
    }
    
    .jb-btn--ghost:hover {
      color: white;
      background: rgba(255, 255, 255, 0.1);
    }
    
    .jb-logo {
      font-size: 18px;
    }
  `;
}
