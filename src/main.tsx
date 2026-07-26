import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Handle WebGL context loss at the global level
window.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  console.warn('[Global] WebGL context lost event detected');
}, false);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
