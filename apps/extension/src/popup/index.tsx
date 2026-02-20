import React from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';
import './styles.css';

const init = () => {
    const container = document.getElementById('root');
    console.log('[Job Bodyguard] Popup initializing...', { container });

    if (container) {
        try {
            const root = createRoot(container);
            root.render(<Popup />);
            console.log('[Job Bodyguard] Popup rendered successfully');
        } catch (error) {
            console.error('[Job Bodyguard] Popup render failed:', error);
            container.innerHTML = '<div style="color: red; padding: 20px;">Error loading popup. Check console.</div>';
        }
    } else {
        console.error('[Job Bodyguard] Root element not found');
        // Retry once if missing
        setTimeout(() => {
            const retryContainer = document.getElementById('root');
            if (retryContainer) {
                const root = createRoot(retryContainer);
                root.render(<Popup />);
                console.log('[Job Bodyguard] Popup rendered on retry');
            }
        }, 100);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
