/**
 * Detect WebGL support BEFORE constructing a renderer. Unsupported browsers
 * must see the #unsupported fallback panel instead of a blank page.
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

/** Show the #unsupported panel (defined in index.html). */
export function showUnsupported(): void {
  const panel = document.getElementById('unsupported');
  const app = document.getElementById('app');
  const loader = document.getElementById('loader');
  if (panel) panel.classList.remove('hidden');
  if (app) app.classList.add('hidden');
  if (loader) loader.classList.add('hidden');
}
