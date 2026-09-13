/**
 * Controls help overlay for the top timeline slider HUD.
 *
 * Framework-free, modal-styled dialog card that lists the HUD's navigation and
 * interaction instructions (timeline keys, mute, help). The module owns its
 * DOM, its open/closed state and focus hand-off (it records and restores the
 * previously focused element); the timeline HUD wires it to the '?' key, the
 * help button and Escape.
 *
 * Glyphs are inline SVG / plain text only — no icon fonts or network assets.
 */

import { ERA_YEARS, type EraId } from '../era/types';

/** Constructor options for `createHelpOverlay`. */
export interface HelpOverlayOptions {
  /** Timeline years shown in the instructions; defaults to `ERA_YEARS`. */
  years?: readonly EraId[];
  /** Invoked whenever the overlay visibility changes (open = true). */
  onVisibilityChange?: (open: boolean) => void;
}

/** Interactable handle returned by `createHelpOverlay`. */
export interface HelpOverlay {
  /** The overlay root element (hosted by the HUD root). */
  readonly element: HTMLDivElement;
  /** Whether the overlay is currently visible. */
  isOpen(): boolean;
  /** Show the overlay, focusing the first control. */
  open(): void;
  /** Hide the overlay, restoring focus to the previously focused element. */
  close(): void;
  /** Tear down the overlay. Safe to call multiple times. */
  dispose(): void;
}

/** Instruction rows rendered as key-cap chips plus a description. */
const INSTRUCTIONS: ReadonlyArray<{ keys: readonly string[]; description: string }> = [
  { keys: ['←', '→'], description: 'Select the previous or next era' },
  { keys: ['Home', 'End'], description: 'Jump to the first or latest era' },
  { keys: ['Click', 'Drag'], description: 'Snap the rail to the nearest era' },
  { keys: ['Mute'], description: 'Silence or restore the audio' },
  { keys: ['?'], description: 'Show or hide this help' },
  { keys: ['Esc', '✕'], description: 'Dismiss this help' },
];

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG child node with the given attributes. */
function svgChild(tag: string, attributes: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

/** Inline SVG close (✕) glyph — no icon font or network asset. */
function closeGlyph(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  const cross = svgChild('path', {
    d: 'M5 5 L19 19 M19 5 L5 19',
    stroke: 'currentColor',
    'stroke-width': '2.6',
    'stroke-linecap': 'round',
    fill: 'none',
  });
  svg.append(cross);
  return svg;
}

/** Set or clear the `hidden` attribute (works for HTML and SVG elements alike). */
function setHidden(element: Element, hidden: boolean): void {
  if (hidden) {
    element.setAttribute('hidden', '');
  } else {
    element.removeAttribute('hidden');
  }
}

/** Build a `<kbd>` key-cap chip. */
function keycap(text: string): HTMLElement {
  const kbd = document.createElement('kbd');
  kbd.className = 'hud-help-kbd';
  kbd.textContent = text;
  return kbd;
}

/**
 * Build the controls help overlay.
 *
 * The overlay is hidden on construction; callers reveal it through `open()`.
 */
export function createHelpOverlay(options: HelpOverlayOptions = {}): HelpOverlay {
  if (typeof document === 'undefined') {
    throw new Error('createHelpOverlay requires a DOM environment.');
  }

  const years = options.years ?? ERA_YEARS;
  const onVisibilityChange = options.onVisibilityChange;
  let open = false;
  let disposed = false;
  let restoreFocus: Element | null = null;

  // --- DOM -------------------------------------------------------------------
  const element = document.createElement('div');
  element.className = 'hud-help-overlay';
  element.dataset.hudHelpOverlay = '';
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-labelledby', 'timeline-help-title');
  setHidden(element, true);

  const card = document.createElement('div');
  card.className = 'hud-help-card';

  const heading = document.createElement('h2');
  heading.id = 'timeline-help-title';
  heading.className = 'hud-help-title';
  heading.textContent = 'Timeline controls';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'hud-help-close';
  closeButton.dataset.hudHelpClose = '';
  closeButton.setAttribute('aria-label', 'Close help');
  closeButton.append(closeGlyph());

  const intro = document.createElement('p');
  intro.className = 'hud-help-intro';
  intro.textContent = 'Jump between five eras — the city block transforms as you move the timeline.';

  const list = document.createElement('ul');
  list.className = 'hud-help-keys';
  for (const item of INSTRUCTIONS) {
    const li = document.createElement('li');
    const chips = document.createElement('span');
    chips.className = 'hud-help-keycaps';
    for (const key of item.keys) {
      chips.append(keycap(key));
    }
    const description = document.createElement('span');
    description.className = 'hud-help-desc';
    description.textContent = item.description;
    li.append(chips, description);
    list.append(li);
  }

  const yearsNote = document.createElement('p');
  yearsNote.className = 'hud-help-years';
  yearsNote.textContent = `Eras: ${years.join(' · ')}`;

  card.append(heading, closeButton, intro, list, yearsNote);
  element.append(card);

  // --- Behavior ---------------------------------------------------------------
  function isOpen(): boolean {
    return open;
  }

  function openOverlay(): void {
    if (disposed || open) {
      return;
    }
    open = true;
    setHidden(element, false);
    restoreFocus = document.activeElement;
    closeButton.focus();
    onVisibilityChange?.(true);
  }

  function closeOverlay(): void {
    if (disposed || !open) {
      return;
    }
    open = false;
    setHidden(element, true);
    if (restoreFocus && restoreFocus.isConnected) {
      (restoreFocus as HTMLElement).focus();
    }
    restoreFocus = null;
    onVisibilityChange?.(false);
  }

  closeButton.addEventListener('click', () => {
    closeOverlay();
  });

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    element.remove();
  }

  return {
    element,
    isOpen,
    open: openOverlay,
    close: closeOverlay,
    dispose,
  };
}