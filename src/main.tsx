import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global error diagnostics
window.addEventListener('error', (event) => {
  console.error('Global error:', event.message, 'at', event.filename, event.lineno + ':' + event.colno, 'error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
