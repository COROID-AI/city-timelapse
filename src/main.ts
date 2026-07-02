/**
 * Application entry point.
 *
 * This is a minimal bootstrap that ensures the Vite build resolves.
 * The full scene wiring (renderer, camera, controls, era switching) is
 * implemented by the downstream "Main scene bootstrap" task, which will
 * replace this stub.
 */
import { prewarmAllEras } from './assetBuilder/eras';

// Pre-warm all era asset sets so the first render is fast.
// (Safe to call multiple times — internal caches guard against re-work.)
try {
  prewarmAllEras();
} catch (err) {
  // In SSR / non-DOM contexts (e.g. Vite build pre-render), canvas may be
  // unavailable. Swallow so the build doesn't break.
  console.warn('[city-timelapse] Asset prewarm skipped:', err);
}

const app = document.getElementById('app');
if (app) {
  app.innerHTML =
    '<div style="color:#fff;font-family:sans-serif;padding:2rem">City Timelapse — scene loading…</div>';
}

console.log('[city-timelapse] Entry point loaded. Full scene bootstrap pending.');
