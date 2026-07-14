import { App } from './core/App';
import './styles.css';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Container #app not found');
}

// Don't await here so the loading screen paints immediately.
void new App(container).init().catch((err) => {
  console.error('Failed to initialize City Era Timelapse:', err);
  // Last-resort fallback on hard failure.
  if (container) {
    container.innerHTML =
      '<div class="webgl-fallback"><div class="fallback-inner"><h1>Unable to start</h1><p>This 3D experience could not initialize.</p></div></div>';
  }
});
