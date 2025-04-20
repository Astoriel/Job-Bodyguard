/**
 * Extension Dashboard — Saved Jobs Page
 * Runs inside the Chrome extension as a full-tab page.
 * No server needed — reads/writes chrome.storage directly.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Dashboard } from './Dashboard';
import './dashboard.css';

const root = document.getElementById('root')!;
createRoot(root).render(<Dashboard />);
