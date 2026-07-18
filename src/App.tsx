import { useCallback, useEffect, useRef, useState } from 'react';
import { Scene } from './scene/Scene';
import { Timeline } from './ui/Timeline';
import { detectWebGL } from './lib/webgl';
import { triggerUnlockChime, wireAudio } from './lib/audio';
import { useEraStore } from './lib/store';
import './index.css';

/**
 * App shell: WebGL capability gate, accessible loading overlay, error fallback,
 * the 3D scene, and the timeline/control overlays. Audio is autoplay-gated
 * until the first user gesture (click/touch/keydown anywhere).
 */
export default function App() {
  const [webglOk] = useState(() => detectWebGL());
  const ready = useEraStore((s) => s.ready);
  const setReady = useEraStore((s) => s.setReady);
  const setWebglOk = useEraStore((s) => s.setWebglOk);
  const muted = useEraStore((s) => s.muted);
  const reduced = useEraStore((s) => s.reducedMotion || s.prefersReducedMotion);

  const audioUnsubRef = useRef<(() => void) | null>(null);

  // Record the WebGL check result in the store.
  useEffect(() => {
    setWebglOk(webglOk);
  }, [webglOk, setWebglOk]);

  // Wire audio subscriptions once (SFX on era change + mute ramping).
  useEffect(() => {
    audioUnsubRef.current = wireAudio();
    return () => {
      audioUnsubRef.current?.();
      audioUnsubRef.current = null;
    };
  }, []);

  // Autoplay gate: unlock + start audio on first user gesture.
  useEffect(() => {
    const unlock = () => {
      triggerUnlockChime();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('touchstart', unlock, { once: false });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  const handleReady = useCallback(() => {
    setReady(true);
  }, [setReady]);

  // Safety: dismiss the loading screen after 8s even on very slow renderers
  // so it never permanently blocks interaction. (onCreated should fire much
  // sooner, but this guarantees the loading state always resolves.)
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => setReady(true), 8000);
    return () => clearTimeout(id);
  }, [ready, setReady]);

  // Global keyboard shortcuts for era navigation (in addition to slider focus).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack typing in inputs (the slider handles its own arrows).
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const setEra = useEraStore.getState().setEra;
      const cur = useEraStore.getState().targetEra;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        setEra(cur + 1);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        setEra(cur - 1);
        e.preventDefault();
      } else if (e.key === 'Home') {
        setEra(0);
        e.preventDefault();
      } else if (e.key === 'End') {
        setEra(5);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // WebGL unavailable → accessible fallback.
  if (!webglOk) {
    return (
      <div className="fallback" role="alert">
        <div className="fallback-card">
          <h1>WebGL Unavailable</h1>
          <p>
            This 3D experience requires WebGL, but your browser or device doesn't
            support it, or it has been disabled.
          </p>
          <p>Try a modern browser with hardware acceleration enabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Scene onReady={handleReady} />

      {/* Accessible loading screen — pointer-events:none so it never blocks
          the timeline even if ready hasn't fired yet on slow renderers. */}
      <div
        className={`loading ${ready ? 'loading-hidden' : ''}`}
        role="status"
        aria-live="polite"
        aria-hidden={ready}
      >
        <div className="loading-inner">
          <div className="spinner" aria-hidden="true" />
          <p>Loading city…</p>
        </div>
      </div>

      {/* Top timeline + controls */}
      <Timeline />

      {/* Bottom-left status pills */}
      <div className="status-bar" aria-hidden={false}>
        <span className={`pill ${muted ? 'off' : 'on'}`} title="Audio status">
          {muted ? '🔇 Muted' : '🔊 Sound'}
        </span>
        <span className={`pill ${reduced ? 'on' : 'off'}`} title="Motion mode">
          {reduced ? '⏸ Reduced motion' : '▶ Full motion'}
        </span>
      </div>

      {/* Bottom-right hint */}
      <div className="hint">
        <span>Drag to orbit · Scroll to zoom · Right-drag to pan</span>
      </div>
    </div>
  );
}
