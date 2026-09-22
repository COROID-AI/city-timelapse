/**
 * Minimal control cluster for the timeline bar: a sound mute toggle and a
 * help toggle that reveals keyboard/pointer hints.
 *
 * Purely presentational — it reports state through callbacks so the owning
 * module (or a later audio system) stays in charge of what "muted" means.
 * Both buttons are real `<button>` elements with toggle semantics
 * (`aria-pressed` for mute, `aria-expanded` for help), and the hints panel is
 * referenced with `aria-controls` so assistive tech follows the disclosure.
 */

/** Copy for the expandable hint list; mirrors what the slider actually does. */
export const TIMELINE_HINTS: readonly string[] = [
  'Drag or click the track to slide between eras; release snaps to the nearest year.',
  'Arrow keys step one era. Page Up and Page Down jump two eras.',
  'Home jumps to 1945; End jumps to 2025.',
  'Touch: slide the playhead along the track, then lift to snap.',
];

export interface ControlClusterOptions {
  /** Document used for element creation; defaults to the global one. */
  doc?: Document;
  /** Fired whenever the muted state changes (initial value is un-muted). */
  onMuteChange?: (muted: boolean) => void;
  /** Fired whenever the hints panel opens or closes. */
  onHelpToggle?: (open: boolean) => void;
}

/** Imperative handle for the mute/help buttons. */
export interface ControlCluster {
  readonly element: HTMLElement;
  readonly muteButton: HTMLButtonElement;
  readonly helpButton: HTMLButtonElement;
  readonly hints: HTMLElement;
  readonly isMuted: boolean;
  readonly isHelpOpen: boolean;
  /** Programmatic mute toggle; notifies `onMuteChange` only on a real change. */
  setMuted(muted: boolean): void;
  /** Programmatic hints toggle; notifies `onHelpToggle` only on a real change. */
  setHelpOpen(open: boolean): void;
  /** Remove listeners and detach the cluster from the DOM. */
  dispose(): void;
}

/** Monotonic id source so `aria-controls` targets stay unique per cluster. */
let hintsIdCounter = 0;

/**
 * Build and return the control cluster (detached). Escape closes the hints
 * panel and returns focus to the help button, matching disclosure-button
 * expectations for keyboard users.
 */
export function createControlCluster(options: ControlClusterOptions = {}): ControlCluster {
  const doc = options.doc ?? document;
  const hintsId = `timeline-control-hints-${(hintsIdCounter += 1)}`;

  const element = doc.createElement('div');
  element.className = 'era-controls';
  element.setAttribute('data-testid', 'timeline-controls');

  // --- sound mute ---------------------------------------------------------
  const muteButton = doc.createElement('button');
  muteButton.type = 'button';
  muteButton.className = 'era-controls__btn';
  muteButton.setAttribute('data-testid', 'mute-toggle');
  muteButton.setAttribute('aria-pressed', 'false');
  muteButton.setAttribute('aria-label', 'Mute sound');
  muteButton.innerHTML =
    '<svg class="era-controls__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path class="era-controls__speaker" d="M4 9.4h3.3L12 5.3v13.4L7.3 14.6H4z" />' +
    '<path class="era-controls__wave" d="M15.4 9.3a4 4 0 0 1 0 5.4" />' +
    '<path class="era-controls__slash" d="M4.8 4.6l14.6 14.8" />' +
    '</svg>';

  // --- help / hints -------------------------------------------------------
  const helpButton = doc.createElement('button');
  helpButton.type = 'button';
  helpButton.className = 'era-controls__btn';
  helpButton.setAttribute('data-testid', 'help-toggle');
  helpButton.setAttribute('aria-expanded', 'false');
  helpButton.setAttribute('aria-controls', hintsId);
  helpButton.setAttribute('aria-label', 'Show control hints');

  const glyph = doc.createElement('span');
  glyph.className = 'era-controls__glyph';
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = '?';
  helpButton.appendChild(glyph);

  const hints = doc.createElement('div');
  hints.className = 'era-controls__hints';
  hints.id = hintsId;
  hints.setAttribute('data-testid', 'hints-panel');
  hints.setAttribute('role', 'group');
  hints.setAttribute('aria-label', 'Timeline control hints');
  hints.hidden = true;

  const title = doc.createElement('p');
  title.className = 'era-controls__hints-title';
  title.textContent = 'Control hints';

  const list = doc.createElement('ul');
  list.className = 'era-controls__hint-list';
  for (const hint of TIMELINE_HINTS) {
    const item = doc.createElement('li');
    item.textContent = hint;
    list.appendChild(item);
  }
  hints.append(title, list);

  element.append(muteButton, helpButton, hints);

  let muted = false;
  let helpOpen = false;

  function setMuted(next: boolean): void {
    if (muted === next) return;
    muted = next;
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    muteButton.classList.toggle('is-muted', muted);
    options.onMuteChange?.(muted);
  }

  function setHelpOpen(next: boolean): void {
    if (helpOpen === next) return;
    helpOpen = next;
    helpButton.setAttribute('aria-expanded', String(helpOpen));
    helpButton.setAttribute('aria-label', helpOpen ? 'Hide control hints' : 'Show control hints');
    hints.hidden = !helpOpen;
    element.classList.toggle('is-help-open', helpOpen);
    options.onHelpToggle?.(helpOpen);
  }

  const onMuteClick = (): void => setMuted(!muted);
  const onHelpClick = (): void => setHelpOpen(!helpOpen);
  const onKeyDown = (event: Event): void => {
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== 'Escape' || !helpOpen) return;
    keyEvent.preventDefault();
    keyEvent.stopPropagation(); // keep Escape from reaching scene-level handlers
    setHelpOpen(false);
    helpButton.focus();
  };

  muteButton.addEventListener('click', onMuteClick);
  helpButton.addEventListener('click', onHelpClick);
  element.addEventListener('keydown', onKeyDown);

  return {
    element,
    muteButton,
    helpButton,
    hints,
    get isMuted(): boolean {
      return muted;
    },
    get isHelpOpen(): boolean {
      return helpOpen;
    },
    setMuted,
    setHelpOpen,
    dispose(): void {
      muteButton.removeEventListener('click', onMuteClick);
      helpButton.removeEventListener('click', onHelpClick);
      element.removeEventListener('keydown', onKeyDown);
      element.remove();
    },
  };
}
