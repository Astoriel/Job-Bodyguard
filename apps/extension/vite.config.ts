import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
    plugins: [
        react(),
        crx({ manifest }),
    ],
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                sidepanel: 'sidepanel.html',
                popup: 'popup.html',
                dashboard: 'dashboard.html',
                settings: 'settings.html',
            },
            output: {
                // Prevent code splitting - inline everything into single files
                inlineDynamicImports: false,
                manualChunks: undefined,
            },
        },
        // Ensure content script is self-contained
        modulePreload: false,
    },
    resolve: {
        alias: {
            '@': '/src',
        },
    },
});
