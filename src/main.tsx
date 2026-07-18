import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

// Remove the static boot fallback once React has mounted.
const boot = document.getElementById('boot-fallback');
if (boot) boot.remove();

createRoot(rootEl).render(<App />);
