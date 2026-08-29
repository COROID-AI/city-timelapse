/**
 * DOM mount helpers: locate the mount element and manage the loading overlay
 * shown until the first frame has actually rendered.
 */
import { LOADING_OVERLAY_SELECTOR } from '../config/paths';

/** Applies the base stylesheet for a full-viewport mount point. */
export function applyBaseStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #0b0e14; }
    #app { position: fixed; inset: 0; }
    #app canvas { display: block; width: 100%; height: 100%; }
  `;
  document.head.appendChild(style);
}

/**
 * Prepares the loading overlay: keeps the base overlay text updated with the
 * boot progress. Returns a function that hides the overlay (fade out then
 * remove). Safe to call multiple times.
 */
export function attachLoadingOverlay(mount: HTMLElement): () => void {
  applyBaseStyles();

  let overlay = document.querySelector<HTMLElement>(LOADING_OVERLAY_SELECTOR);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = LOADING_OVERLAY_SELECTOR.slice(1);
    overlay.textContent = 'Loading…';
    document.body.appendChild(overlay);
  }

  // The overlay is `position: fixed`, so moving it into the mount does not
  // change its visual position, but guarantees the single #loading element
  // lives inside #app and `hide()` removes the only instance.
  if (!mount.contains(overlay)) {
    mount.appendChild(overlay);
  }

  const hide = (): void => {
    overlay.style.transition = 'opacity 400ms ease';
    overlay.style.opacity = '0';
    window.setTimeout(() => overlay.remove(), 450);
  };

  return hide;
}

/**
 * Marks the boot sequence as failed by removing the loading overlay and
 * rendering a plain message inside the mount point. Exported for tests.
 */
export function showBootFailure(mount: HTMLElement, message: string): void {
  const existing = mount.querySelector('[data-boot-failure]');
  existing?.remove();
  const note = document.createElement('div');
  note.setAttribute('data-boot-failure', 'true');
  note.textContent = message;
  mount.appendChild(note);
}