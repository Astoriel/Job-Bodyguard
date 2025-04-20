import React from 'react';
import { createRoot } from 'react-dom/client';
import { Settings } from './Settings';
import './settings.css';

const root = document.getElementById('root')!;
createRoot(root).render(<Settings />);
