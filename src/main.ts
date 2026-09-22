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

const container = document.querySelector<HTMLElement>('#app');
if (!container) {
  throw new Error('App container #app is missing from index.html');
}

const shell = createAppShell(container);

// Expose the shell for later domain modules and debugging in dev builds.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__timelapseShell = shell;
}

shell.start();
