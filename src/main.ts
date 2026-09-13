/**
 * Application entry stub for the City Time Period Timelapse.
 *
 * Temporary placeholder: it proves the Vite entrypoint (index.html ->
 * src/main.ts) resolves and the DOM mount point is reachable. The
 * scene-integration phase replaces this body with the real boot sequence
 * (Three.js scene, era slider, SFX).
 */

export const APP_TITLE = 'City Time Period Timelapse';

/** Value written to `data-app-stub` so tests and tooling can detect the stub. */
export const APP_STUB_MARKER = 'app-stub';

/**
 * Replace the contents of `root` with the placeholder stub UI.
 * Returns the created stub element.
 */
export function initApp(root: HTMLElement): HTMLElement {
  root.replaceChildren();

  const stub = document.createElement('article');
  stub.dataset.appStub = APP_STUB_MARKER;
  stub.className = 'app-stub';

  const heading = document.createElement('h1');
  heading.textContent = APP_TITLE;

  const note = document.createElement('p');
  note.textContent = 'Foundation scaffold is ready — the scene boot sequence lands in a later phase.';

  stub.append(heading, note);
  root.append(stub);
  return stub;
}

// Bootstrap when loaded in a browser through /src/main.ts. The jsdom test
// recreates the same path by creating #app before importing this module.
if (typeof document !== 'undefined') {
  const root = document.getElementById('app') ?? document.body;
  initApp(root);
}