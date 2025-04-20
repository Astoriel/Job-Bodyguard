/**
 * Post-build script to fix CRXJS dev-server references
 * Creates an injector script that properly loads the ES module content script
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '..', 'dist');
const manifestPath = path.join(distDir, 'manifest.json');
const assetsDir = path.join(distDir, 'assets');

// Read the generated manifest
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Find the actual bundled files
const assetFiles = fs.readdirSync(assetsDir);

// Find background script (index.ts-*.js)
const bgScript = assetFiles.find(f => f.startsWith('index.ts-') && f.endsWith('.js'));
// Find content script (index.tsx-*.js, but NOT loader)
const contentScript = assetFiles.find(f => f.startsWith('index.tsx-') && f.endsWith('.js') && !f.includes('loader'));

if (!bgScript) {
    console.error('Could not find background script in assets!');
    process.exit(1);
}

if (!contentScript) {
    console.error('Could not find content script in assets!');
    process.exit(1);
}

console.log('Found background script:', bgScript);
console.log('Found content script:', contentScript);

// Create an injector script that:
// 1. Creates a visual indicator
// 2. Loads the ES module content script
// 3. Listens for postMessage from the page and forwards to chrome.runtime
const injectorCode = `
(function() {
    // Prevent double injection
    if (window.__JOB_BODYGUARD_INJECTING__) return;
    window.__JOB_BODYGUARD_INJECTING__ = true;
    
    console.log('[Job Bodyguard Injector] Starting on:', window.location.href);
    
    // Create visual indicator immediately (this runs in extension context, can modify DOM safely)
    const indicator = document.createElement('div');
    indicator.id = 'jb-indicator';
    indicator.style.cssText = 'position:fixed !important;bottom:20px !important;left:20px !important;width:20px !important;height:20px !important;border-radius:50% !important;background:#ffff00 !important;z-index:2147483647 !important;border:3px solid #000 !important;cursor:pointer !important;box-shadow:0 2px 10px rgba(0,0,0,0.5) !important;';
    indicator.title = 'Job Bodyguard: Loading...';
    
    // Wait for body
    const appendIndicator = () => {
        if (document.body) {
            document.body.appendChild(indicator);
            console.log('[Job Bodyguard Injector] Indicator added to DOM');
        } else {
            setTimeout(appendIndicator, 100);
        }
    };
    appendIndicator();
    
    // Listen for messages from the injected page script
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== 'job-bodyguard-content') return;
        
        console.log('[Job Bodyguard Injector] Received message from page:', event.data);
        
        const { type, payload } = event.data;
        
        // Update indicator based on status
        if (type === 'STATUS_UPDATE') {
            indicator.style.background = payload.color;
            indicator.title = payload.title;
        }
        
        // Forward chrome messages
        if (type === 'CHROME_MESSAGE') {
            try {
                chrome.runtime.sendMessage(payload, (response) => {
                    console.log('[Job Bodyguard Injector] Chrome response:', response);
                });
            } catch (e) {
                console.error('[Job Bodyguard Injector] Failed to send chrome message:', e);
            }
        }
    });
    
    // Inject the main content script as a module
    const script = document.createElement('script');
    script.type = 'module';
    script.src = chrome.runtime.getURL('assets/${contentScript}');
    script.onload = () => {
        console.log('[Job Bodyguard Injector] Content script module loaded');
    };
    script.onerror = (e) => {
        console.error('[Job Bodyguard Injector] Failed to load content script:', e);
        indicator.style.background = '#ff0000';
        indicator.title = 'Job Bodyguard: Failed to load';
    };
    (document.head || document.documentElement).appendChild(script);
})();
`;

// Write the injector script
const injectorPath = path.join(distDir, 'content-injector.js');
fs.writeFileSync(injectorPath, injectorCode);
console.log('Created content-injector.js');

// Fix the manifest with broader patterns for all regional domains
manifest.background = {
    service_worker: `assets/${bgScript}`,
    type: 'module'
};

// Use wildcards to catch all regional subdomains
manifest.content_scripts = [{
    js: ['content-injector.js'],
    matches: [
        "https://*.linkedin.com/*",
        "https://linkedin.com/*",
        "https://*.indeed.com/*",
        "https://indeed.com/*",
        "https://hh.ru/*",
        "https://*.hh.ru/*"
    ],
    run_at: "document_start"  // Run earlier to ensure we catch the page
}];

// Update web_accessible_resources
manifest.web_accessible_resources = [{
    matches: ["<all_urls>"],
    resources: [
        ...assetFiles.map(f => `assets/${f}`),
        'content-injector.js'
    ],
    use_dynamic_url: false
}];

// Write fixed manifest
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Manifest fixed!');

// Delete loader files
const rootLoaderPath = path.join(distDir, 'service-worker-loader.js');
if (fs.existsSync(rootLoaderPath)) {
    fs.unlinkSync(rootLoaderPath);
    console.log('Deleted service-worker-loader.js');
}

const loaderFiles = assetFiles.filter(f => f.includes('loader'));
for (const loader of loaderFiles) {
    const loaderPath = path.join(assetsDir, loader);
    if (fs.existsSync(loaderPath)) {
        fs.unlinkSync(loaderPath);
        console.log('Deleted loader:', loader);
    }
}

// Delete vendor directory if it exists
const vendorDir = path.join(distDir, 'vendor');
if (fs.existsSync(vendorDir)) {
    fs.rmSync(vendorDir, { recursive: true, force: true });
    console.log('Deleted vendor directory');
}

// Delete src directory in dist if it exists
const srcDistDir = path.join(distDir, 'src');
if (fs.existsSync(srcDistDir)) {
    fs.rmSync(srcDistDir, { recursive: true, force: true });
    console.log('Deleted src directory from dist');
}

console.log('\\n✅ Build fixed! Load the dist folder in Chrome.');
