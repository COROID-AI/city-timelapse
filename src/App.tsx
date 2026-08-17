import { useEffect, useCallback } from 'react';
import { useStore } from './state/store';
import { getEra } from './eras/config';
import { Experience } from './scene/Experience';
import { Timeline } from './ui/Timeline';
import { EraPanel } from './ui/EraPanel';
import { ControlsBar } from './ui/ControlsBar';
import { HelpOverlay } from './ui/HelpOverlay';
import { InfoCard } from './ui/InfoCard';
import { ErrorFallback } from './ui/ErrorFallback';
import { audioEngine } from './audio/engine';
import { playAmbientForEra, stopAmbient } from './audio/ambient';
import './ui/hud.css';

export default function App() {
  const currentEra = useStore(state => state.currentEra);
  const selectedEra = useStore(state => state.selectedEra);
  const transitioning = useStore(state => state.transitioning);
  const muted = useStore(state => state.muted);
  const volume = useStore(state => state.volume);
  const resetCamera = useStore(state => state.reset);
  const toggleMute = useStore(state => state.toggleMute);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        // Handled by HelpOverlay
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        resetCamera();
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        useStore.getState().togglePlay();
        return;
      }
      if (e.key === 'ArrowRight') {
        useStore.getState().nextEra();
        return;
      }
      if (e.key === 'ArrowLeft') {
        useStore.getState().prevEra();
        return;
      }
      // Number keys 1-6 for eras
      const num = parseInt(e.key);
      if (num >= 1 && num <= 6) {
        const eras = ['1945', '1965', '1985', '2005', '2025', '2055'];
        if (eras[num - 1]) {
          useStore.getState().selectEra(eras[num - 1] as any);
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [resetCamera, toggleMute]);

  // Audio init on first interaction
  const initAudio = useCallback(() => {
    if (!audioEngine.isAvailable()) return;
    audioEngine.init();
    audioEngine.setVolume(volume);
    audioEngine.setMuted(muted);
  }, [volume, muted]);

  useEffect(() => {
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
  }, [initAudio]);

  // Update audio settings
  useEffect(() => {
    audioEngine.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    audioEngine.setVolume(volume);
  }, [volume]);

  // Play ambience when era changes
  useEffect(() => {
    const activeKey = selectedEra || currentEra;
    playAmbientForEra(activeKey);
    return () => stopAmbient();
  }, [currentEra, selectedEra, transitioning]);

  return (
    <div className="app-container">
      <Timeline />
      <EraPanel />
      <ControlsBar />
      <HelpOverlay />
      <InfoCard />

      <Experience />
    </div>
  );
}
