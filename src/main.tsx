import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { registerPwa } from './app/pwa';
import './app/app.css';
import './app/workspace.css';
import { applyTheme } from './core/themes';
import { getSettings } from './app/settings';

applyTheme(document.documentElement, getSettings().theme);

registerPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
