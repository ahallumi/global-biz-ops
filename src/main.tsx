import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Enhanced global error diagnostics
window.addEventListener('error', (event) => {
  console.error('🚨 Global Error:', {
    message: event.message,
    filename: event.filename,
    location: `${event.lineno}:${event.colno}`,
    error: event.error,
    stack: event.error?.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent.substring(0, 100)
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled Promise Rejection:', {
    reason: event.reason,
    stack: event.reason?.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href
  });
});

// Catch resource loading errors specifically
window.addEventListener('error', (event) => {
  if (event.target && event.target !== window) {
    const target = event.target as any; // Type cast for resource elements
    console.error('🚨 Resource Load Error:', {
      element: target.tagName || 'Unknown',
      src: target.src || target.href || 'No source',
      message: event.message || 'Load failed',
      timestamp: new Date().toISOString()
    });
  }
}, true); // Use capture phase to catch all resource errors

// TEMPORARY for password-reset rollout; remove after first successful test
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
  if (window.caches?.keys) caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
}

createRoot(document.getElementById("root")!).render(<App />);
