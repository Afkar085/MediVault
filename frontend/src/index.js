import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { API_ORIGIN } from './api';

// Open the connection to the API while React is still mounting. The first
// request otherwise pays for DNS, TCP and TLS before a single byte of the
// dashboard can be asked for, which on a phone is most of a second. Done here
// rather than in index.html because the API host comes from the build's
// environment and differs between local, preview and production.
if (API_ORIGIN) {
  ['preconnect', 'dns-prefetch'].forEach((rel) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = API_ORIGIN;
    if (rel === 'preconnect') link.crossOrigin = '';
    document.head.appendChild(link);
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
