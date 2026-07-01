// Entry point. Boots the WebGL scene, wires the UI + audio, and runs the
// animation loop. All failure paths surface a textual fallback in #fallback
// so the page never silently breaks (acceptance: no console errors / uncaught).

import './styles.css';
import { ERAS } from './eras';
import { CityScene } from './scene';
import { AudioEngine } from './audio';
import { buildUI } from './ui';

function fail(message: string): never {
  const fb = document.getElementById('fallback');
  if (fb) {
    fb.hidden = false;
    fb.textContent = message;
  }
  // eslint-disable-next-line no-console
  console.error('[CityTimelapse]', message);
  throw new Error(message);
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) return fail('Missing #app container.');

  let scene: CityScene;
  try {
    scene = new CityScene(app);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return fail(`Failed to initialise WebGL scene: ${msg}`);
  }

  const audio = new AudioEngine();

  // Build the UI; era changes drive both scene + audio.
  const ui = buildUI(app, {
    onEraChange: (index) => {
      scene.transitionTo(index);
      // Audio: init/resume on first user interaction (autoplay policy).
      audio.init();
      audio.resume();
      audio.applyEra(ERAS[Math.max(0, Math.min(ERAS.length - 1, index))]);
    },
  });

  // Mute control.
  const muteBtn = document.getElementById('mute');
  muteBtn?.addEventListener('click', () => {
    const next = !audio.isMuted();
    audio.setMuted(next);
    ui.setMuted(next);
  });

  // Resize handling.
  const onResize = (): void => scene.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', onResize);

  // Animation loop.
  let raf = 0;
  const animate = (): void => {
    scene.update();
    raf = requestAnimationFrame(animate);
  };
  raf = requestAnimationFrame(animate);

  // WebGL context-loss fallback.
  scene.renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    fail('WebGL context lost. Please reload the page.');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
