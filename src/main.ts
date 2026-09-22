/**
 * Application entry point.
 *
 * Boots the Three.js render shell (scene, render loop, resize handling,
 * empty `cityRoot` group) and mounts the fixed top UI overlay root that
 * later tasks fill with the era timeline slider.
 *
 * Client-only invariant: the bundle never performs runtime network access,
 * so no fetch, XMLHttpRequest, or WebSocket calls are used anywhere in src.
 */

import './styles.css';
import { createAppShell } from './scene/shell';
import { mountTimelineUI } from './ui/timeline';

const container = document.querySelector<HTMLElement>('#app');
if (!container) {
  throw new Error('App container #app is missing from index.html');
}

const shell = createAppShell(container);

// Fixed-top era timeline. It owns no scene state: selections flow through
// the shared era timeline core (exposed on `timeline.core`) that scene
// morphing will later share, and its internal frame loop advances that core.
const timeline = mountTimelineUI({ container: shell.overlayRoot });

// Expose the shell and timeline for later domain modules and dev debugging.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__timelapseShell = shell;
  (window as unknown as Record<string, unknown>).__timelapseTimeline = timeline;
}

shell.start();
