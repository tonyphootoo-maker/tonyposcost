import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Register PWA service worker for offline use (using relative path for GitHub Pages sub-path support)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Ignore registration errors in dev or restricted sandboxes
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
