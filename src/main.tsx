import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Self-hosted fonts (served from 'self', keeps font-src 'self' CSP intact).
import '@fontsource-variable/outfit';
import '@fontsource-variable/noto-sans-jp';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
