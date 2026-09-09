/**
 * Start Overlay component for City Time Period Timelapse.
 *
 * Provides the first user-gesture barrier satisfying browser WebAudio autoplay
 * policy, displays intro briefing copy, and fires onStart to initiate camera navigation.
 */

export interface StartOverlayOptions {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  onStart?: () => void;
}

export interface StartOverlay {
  readonly element: HTMLElement;
  readonly button: HTMLButtonElement;
  dismiss(): void;
  isVisible(): boolean;
  dispose(): void;
}

export function createStartOverlay(
  container: HTMLElement,
  options: StartOverlayOptions = {},
): StartOverlay {
  const overlay = document.createElement('div');
  overlay.className = 'timelapse-start-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Experience Introduction');

  const card = document.createElement('div');
  card.className = 'start-card';

  const badge = document.createElement('div');
  badge.className = 'start-badge';
  badge.textContent = 'Interactive 3D Timelapse';

  const title = document.createElement('h1');
  title.className = 'start-title';
  title.textContent = options.title ?? 'City Time Period Timelapse';

  const desc = document.createElement('p');
  desc.className = 'start-description';
  desc.textContent =
    options.subtitle ??
    'Witness 80 years of urban transformation across five distinct architectural eras (1945–2025). Dynamic lighting, vehicles, crowds, and synthesized era soundtracks.';

  const button = document.createElement('button');
  button.className = 'start-button';
  button.type = 'button';
  button.setAttribute('aria-label', 'Enter the scene');
  button.innerHTML = `
    <span class="start-btn-icon" aria-hidden="true">▶</span>
    <span class="start-btn-text">${options.buttonText ?? 'Enter the scene'}</span>
  `;

  const hint = document.createElement('div');
  hint.className = 'start-hint';
  hint.textContent = 'Clicking unlocks WebAudio ambience and initiates camera intro.';

  card.appendChild(badge);
  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(button);
  card.appendChild(hint);
  overlay.appendChild(card);

  container.appendChild(overlay);

  let dismissed = false;

  function triggerStart(): void {
    if (dismissed) return;
    dismissed = true;
    overlay.classList.add('fade-out');
    options.onStart?.();

    // Remove from DOM after transition finishes
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 400);
  }

  button.addEventListener('click', triggerStart);

  return {
    element: overlay,
    button,
    dismiss() {
      triggerStart();
    },
    isVisible() {
      return !dismissed && overlay.parentNode !== null;
    },
    dispose() {
      button.removeEventListener('click', triggerStart);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      dismissed = true;
    },
  };
}
