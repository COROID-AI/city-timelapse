import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { EraProvider } from './contexts/EraContext';
import { AudioContextProvider } from './contexts/AudioContext';
import App from './App';
import './styles/main.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EraProvider>
      <AudioContextProvider>
        <App />
      </AudioContextProvider>
    </EraProvider>
  </StrictMode>
);
