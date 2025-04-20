/**
 * Content Script — Job Bodyguard
 *
 * Key design decisions vs previous version:
 *  1. Direct chrome.storage writes (no background needed for currentJob)
 *     → Works even when service worker is sleeping
 *  2. waitForElement() before parsing instead of fixed timeouts
 *     → Handles slow LinkedIn/Indeed DOM rendering
 *  3. Three SPA-detection strategies: pushState patch, interval poll, MutationObserver
 *  4. Banner re-injection if removed by the host page
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { getParserForUrl, FlagAnalyzer } from '@job-bodyguard/parsers';
import type { JobData } from '@job-bodyguard/types';
import { FloatingBanner } from './FloatingBanner';

// ─── DOM helper ───────────────────────────────────────────────
/**
 * Wait until a CSS selector matches something in the DOM.
 * Much more reliable than fixed setTimeout for SPA pages.
 */
function waitForElement(selector: string, timeoutMs = 8000): Promise<Element | null> {
  const existing = document.querySelector(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { obs.disconnect(); resolve(el); }
      else if (Date.now() > deadline) { obs.disconnect(); resolve(null); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // Safety net
    setTimeout(() => { obs.disconnect(); resolve(document.querySelector(selector)); }, timeoutMs);
  });
}

// ─── State tracking ──────────────────────────────────────────
let _lastJobKey = getJobKey(window.location.href);
let _parseInProgress = false;

function getJobKey(url: string): string {
  try {
    const u = new URL(url);
    // Indeed split-pane: vjk=XXX
    // Indeed direct page: jk=XXX  (e.g. /viewjob?jk=XXX or /m/viewjob?jk=XXX)
    // LinkedIn: currentJobId=XXX
    // hh.ru: /vacancy/XXX
    return (
      u.searchParams.get('vjk') ||
      u.searchParams.get('jk') ||
      u.searchParams.get('currentJobId') ||
      u.pathname.match(/\/vacancy\/(\d+)/)?.[1] ||
      url
    );
  } catch {
    return url;
  }
}

// ─── Guard against duplicate injection ───────────────────────
if (!(window as any).__JBG_LOADED__) {
  (window as any).__JBG_LOADED__ = true;
  init();
}

function init() {
  console.log('[JBG] Content script loaded on:', window.location.href);

  // 1. Patch history for SPA navigation
  patchHistory();
  window.addEventListener('popstate', () => void handleNavChange());

  // 2. Polling fallback (800ms) — catches anything pushState misses
  setInterval(() => {
    const key = getJobKey(window.location.href);
    if (key !== _lastJobKey) void handleNavChange();
  }, 800);

  // 3. Listen for popup requesting a re-parse (e.g. stale data detected)
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'JBG_TRIGGER_PARSE') {
      console.log('[JBG] 🔁 Re-parse requested by popup on:', window.location.href);
      _parseInProgress = false; // reset guard so re-parse can run
      void tryParsePage();
      sendResponse({ ok: true });
    }
    return false;
  });

  // 3. Initial parse
  void tryParsePage();
}

// ─── Navigation handling ──────────────────────────────────────
function patchHistory() {
  for (const method of ['pushState', 'replaceState'] as const) {
    const orig = history[method].bind(history);
    (history as any)[method] = (...args: Parameters<typeof history.pushState>) => {
      orig(...args);
      void handleNavChange();
    };
  }
}

async function handleNavChange() {
  const newKey = getJobKey(window.location.href);
  if (newKey === _lastJobKey) return;
  console.log('[JBG] Navigation:', _lastJobKey, '→', newKey);
  _lastJobKey = newKey;

  // Immediately clear stale data so popup shows "reading..."
  await clearCurrentJob();
  removeBanner();
  void tryParsePage();
}

// ─── Storage (direct — no background needed) ─────────────────
async function clearCurrentJob(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove('currentJob', resolve);
  });
}

async function storeCurrentJob(job: JobData): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ currentJob: job }, resolve);
  });
}

// ─── Parsing ─────────────────────────────────────────────────
// Title selectors shared across parsers (used to wait for DOM readiness)
const TITLE_WAIT_SELECTORS = [
  // LinkedIn (logged-in view)
  '.job-details-jobs-unified-top-card__job-title',
  '.jobs-unified-top-card__job-title',
  'h1.t-24',
  // LinkedIn (public / guest view — ca., fr., uk. subdomains)
  'h1.top-card-layout__title',
  '.top-card-layout__title',
  // Indeed
  '[data-testid="jobsearch-JobInfoHeader-title"]',
  'h1.jobsearch-JobInfoHeader-title',
  // hh.ru
  '[data-qa="vacancy-title"]',
  // Universal fallback — any h1 (LinkedIn always has one in job panels)
  'h1',
].join(', ');

async function tryParsePage() {
  if (_parseInProgress) {
    console.log('[JBG] ⏳ parse already in progress, skipping');
    return;
  }
  _parseInProgress = true;

  try {
    const url = window.location.href;
    console.log('[JBG] 🔍 tryParsePage() on:', url);

    const parser = getParserForUrl(url);
    if (!parser) {
      console.warn('[JBG] ❌ No parser matched for URL:', url);
      return;
    }
    console.log('[JBG] ✅ Parser found:', parser.platform);

    // Try to parse with retries — more robust than waitForElement on SPAs
    // that do full-body DOM swaps (LinkedIn) where MutationObserver can miss the swap.
    const MAX_ATTEMPTS = 8;
    const RETRY_INTERVAL = 2000; // ms

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Small delay on first attempt to let the initial render settle
      if (attempt === 1) await new Promise(r => setTimeout(r, 600));

      console.log(`[JBG] 📦 Parse attempt ${attempt}/${MAX_ATTEMPTS}...`);

      // Quick sanity check — log what's in the DOM right now
      const h1Text = document.querySelector('h1')?.textContent?.trim().slice(0, 80);
      const knownTitle = document.querySelector(TITLE_WAIT_SELECTORS)?.textContent?.trim().slice(0, 80);
      console.log(`[JBG]   h1="${h1Text ?? 'null'}"  knownTitle="${knownTitle ?? 'null'}"`);

      let jobData = await parser.extractJobData(document);
      console.log('[JBG] 📦 Extracted:', {
        title: jobData.title,
        company: jobData.company,
        location: jobData.location,
        descLen: jobData.description?.length,
      });

      if (!jobData.title && !jobData.company) {
        if (attempt < MAX_ATTEMPTS) {
          console.warn(`[JBG] ⚠️ Empty result — retrying in ${RETRY_INTERVAL}ms...`);
          await new Promise(r => setTimeout(r, RETRY_INTERVAL));
          continue;
        } else {
          console.error('[JBG] ❌ All attempts exhausted, giving up.');
          return;
        }
      }

      if (!jobData.title) console.warn('[JBG] ⚠️ title empty but company found, continuing');
      if (!jobData.company) console.warn('[JBG] ⚠️ company empty but title found, continuing');

      const flagAnalyzer = new FlagAnalyzer();
      const { redFlags, greenFlags } = flagAnalyzer.analyze(jobData.description);
      jobData = {
        ...jobData,
        redFlags: [...jobData.redFlags, ...redFlags],
        greenFlags: [...jobData.greenFlags, ...greenFlags],
      };

      console.log('[JBG] ✅ Storing job:', jobData.title, '@', jobData.company);
      await storeCurrentJob(jobData);
      console.log('[JBG] ✅ Stored to chrome.storage.local.currentJob');

      chrome.runtime.sendMessage(
        { type: 'JOB_DATA_EXTRACTED', payload: jobData, timestamp: Date.now() },
        () => { void chrome.runtime.lastError; }
      );

      injectBanner(jobData);
      return; // success
    }

  } catch (err) {
    console.error('[JBG] 💥 Parse exception:', err);
  } finally {
    _parseInProgress = false;
  }
}

// ─── Floating Banner ─────────────────────────────────────────
let _bannerRoot: ReturnType<typeof createRoot> | null = null;
let _bannerContainer: HTMLElement | null = null;

function removeBanner() {
  _bannerContainer?.remove();
  _bannerContainer = null;
  _bannerRoot = null;
}

function injectBanner(jobData: JobData) {
  removeBanner();

  const container = document.createElement('div');
  container.id = 'job-bodyguard-banner';
  // Inject on <html> not <body> so page React can't accidentally unmount us
  document.documentElement.appendChild(container);
  _bannerContainer = container;

  const shadow = container.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = BANNER_CSS;
  const mount = document.createElement('div');
  shadow.appendChild(style);
  shadow.appendChild(mount);

  _bannerRoot = createRoot(mount);

  // Watch if LinkedIn/Indeed removes our banner and re-inject
  startBannerGuard(jobData);

  renderBanner(jobData);
}

function renderBanner(jobData: JobData) {
  if (!_bannerRoot) return;
  _bannerRoot.render(
    <FloatingBanner
      jobData={jobData}
      onAnalyze={() => {
        chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL', payload: null, timestamp: Date.now() });
      }}
      onSave={(onResult) => {
        chrome.runtime.sendMessage(
          { type: 'SAVE_TO_DASHBOARD', payload: jobData, timestamp: Date.now() },
          (res) => { onResult(!chrome.runtime.lastError && res?.success); }
        );
      }}
      onClose={removeBanner}
    />
  );
}

// Re-inject banner if the host page removes it
let _bannerGuard: ReturnType<typeof setInterval> | null = null;
function startBannerGuard(jobData: JobData) {
  if (_bannerGuard) clearInterval(_bannerGuard);
  _bannerGuard = setInterval(() => {
    if (_bannerContainer && !document.documentElement.contains(_bannerContainer)) {
      console.log('[JBG] Banner removed by page, re-injecting...');
      injectBanner(jobData);
    }
  }, 1500);
}

// ─── Banner Styles ────────────────────────────────────────────
const BANNER_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :host {
    /* TF2 / Spy Theme Colors */
    --spy-orange: #ff9d00;
    --spy-orange-dim: #cc7d00;
    --spy-red: #b8383b;
    --spy-blue: #5885a2;
    --spy-dark: #231f20;
    --spy-dark-card: #2e282a;
    --spy-text-light: #f4ece4;
    --spy-border: #4a413f;

    /* Typography */
    --font-display: 'Impact', 'Arial Black', sans-serif;
    --font-body: 'Courier New', Courier, monospace;
    all: initial;
  }

  .banner {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    background-color: var(--spy-dark-card);
    border: 2px solid var(--spy-border);
    font-family: var(--font-body);
    max-width: 650px;
    animation: slideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    color: var(--spy-text-light);
    pointer-events: all;
    box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);

    /* Angled corner effect */
    clip-path: polygon(0 0,
            100% 0,
            100% calc(100% - 15px),
            calc(100% - 15px) 100%,
            0 100%);
  }
  
  .banner::after {
    content: '';
    position: absolute;
    bottom: 0;
    right: 0;
    width: 15px;
    height: 15px;
    background: var(--spy-orange);
    clip-path: polygon(0 100%, 100% 0, 100% 100%);
  }

  @keyframes slideIn {
    from { transform: translateX(calc(100% + 24px)); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }

  .banner__logo { font-size: 20px; flex-shrink: 0; }

  .banner__flags {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background-color: var(--spy-border);
    color: var(--spy-text-light);
    font-size: 11px;
    font-family: var(--font-body);
    white-space: normal;
    word-break: break-word;
    line-height: 1.3;
    border-left: 3px solid var(--spy-orange);
    text-transform: uppercase;
  }

  .badge--age   { border-color: var(--spy-blue); color: #8cbbe0; }
  .badge--old   { border-color: var(--spy-orange); color: #ffd699; }
  .badge--sal   { border-color: #10b981; color: #6ee7b7; }
  .badge--red   { border-color: var(--spy-red); color: #ff9999; }
  .badge--green { border-color: var(--spy-blue); color: #8cbbe0; }

  .banner__actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; position: relative; z-index: 2; }

  .btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 12px; border: none; 
    font-size: 12px; cursor: pointer;
    transition: all 0.18s ease; white-space: nowrap; font-family: var(--font-display);
    text-transform: uppercase; letter-spacing: 0.5px;
    line-height: 1.2;
  }

  .btn--analyze {
    background-color: var(--spy-orange);
    color: var(--spy-dark);
    clip-path: polygon(0 0,
            100% 0,
            100% calc(100% - 8px),
            calc(100% - 8px) 100%,
            0 100%);
  }
  .btn--analyze:hover { 
    background-color: var(--spy-orange-dim); 
    transform: translate(-1px, -1px); 
    box-shadow: 2px 2px 0 rgba(0,0,0,0.5); 
  }

  .btn--save {
    background-color: transparent;
    color: var(--spy-text-light);
    border: 1px dashed var(--spy-border);
  }
  .btn--save:hover:not(:disabled) { border-color: var(--spy-orange); color: var(--spy-orange); }
  .btn--save:disabled { cursor: not-allowed; opacity: 0.6; }
  .btn--save.saving { opacity: 0.6; }
  .btn--save.saved  { background-color: rgba(88, 133, 162, 0.15); color: #8cbbe0; border: 1px solid var(--spy-blue); }
  .btn--save.error  { background-color: rgba(184, 56, 59, 0.15); color: #ff9999; border: 1px solid var(--spy-red); }

  .btn--close {
    background: transparent; color: rgba(244, 236, 228, 0.5);
    padding: 5px 7px; font-size: 16px; border: none; font-family: var(--font-body);
  }
  .btn--close:hover { color: var(--spy-text-light); }
`;
