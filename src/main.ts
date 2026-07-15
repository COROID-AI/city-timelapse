import './style.css';
import { Experience } from './Experience';
import { UI } from './ui/UI';
import { isWebGLAvailable, showUnsupported } from './webgl-check';

/**
 * Entry point. Checks WebGL first; if unsupported, shows the fallback panel
 * and never constructs a renderer. Otherwise boots the experience + UI.
 */
function boot(): void {
  if (!isWebGLAvailable()) {
    showUnsupported();
    return;
  }

  const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
  if (!canvas) {
    console.error('Canvas element #scene not found.');
    return;
  }

  let exp: Experience;
  try {
    exp = new Experience(canvas);
  } catch (err) {
    console.error('Failed to initialise WebGL experience.', err);
    showUnsupported();
    return;
  }

  const ui = new UI(exp);
  exp.start();

  // Hide the loader after the first rendered frame (next tick ensures one
  // render has occurred). The loader is non-interactive (pointer-events:none)
  // so it never blocks UI interaction during the brief fade.
  requestAnimationFrame(() => ui.hideLoader());
}

boot();
