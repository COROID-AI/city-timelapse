/**
 * Detail callout panel for focused scene objects.
 *
 * Content-agnostic by design: the panel renders whatever `CalloutContent` the
 * navigation module's content provider supplies. The integration owner wires
 * that provider to era-aware content, so this module never imports era or
 * content code and stays independent within its phase.
 *
 * Accessibility: the panel is a labelled region with `aria-hidden` state that
 * mirrors visibility, a keyboard-focusable close button, and an animated
 * open/close transition that respects `prefers-reduced-motion`.
 */

import './callouts.css';

/** Text payload rendered inside a callout; all fields except title optional. */
export interface CalloutContent {
  /** Heading, e.g. an object or storefront name. */
  title: string;
  /** Small overline, e.g. an era label like "1965". */
  eyebrow?: string;
  /** One or two sentences of descriptive detail. */
  description?: string;
  /** Short fact lines rendered as chips beneath the description. */
  facts?: readonly string[];
  /** Optional accent color (CSS color) themed to the era/content. */
  accent?: string;
}

export interface CalloutPanelOptions {
  /** Where the panel element is mounted (usually the UI overlay root). */
  container: HTMLElement;
  /** Invoked when the user clicks the panel's close button. */
  onClose?: () => void;
}

/** Imperative handle for showing/hiding the detail callout. */
export interface CalloutPanel {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  /** Render content and animate the panel open (idempotent while open). */
  show(content: CalloutContent): void;
  /** Animate the panel closed; content stays mounted for the next show. */
  hide(): void;
  /** Remove the panel from the DOM permanently. */
  dispose(): void;
}

/**
 * Create and mount a callout panel inside `options.container`.
 *
 * The panel starts closed (`aria-hidden="true"`, no `.is-open` class) and is
 * purely presentational — dismissal semantics (Esc, empty click) live in the
 * navigation module, which owns the close callback wiring.
 */
export function createCalloutPanel(options: CalloutPanelOptions): CalloutPanel {
  const doc = options.container.ownerDocument;
  const handleClose = (): void => options.onClose?.();

  const element = doc.createElement('aside');
  element.className = 'callout';
  element.setAttribute('data-testid', 'callout-panel');
  element.setAttribute('role', 'region');
  element.setAttribute('aria-label', 'Object details');
  element.setAttribute('aria-hidden', 'true');

  const closeButton = doc.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'callout__close';
  closeButton.setAttribute('data-testid', 'callout-close');
  closeButton.setAttribute('aria-label', 'Close details');
  closeButton.textContent = '\u2715';
  closeButton.addEventListener('click', handleClose);

  const eyebrow = doc.createElement('p');
  eyebrow.className = 'callout__eyebrow';
  eyebrow.setAttribute('data-testid', 'callout-eyebrow');
  eyebrow.hidden = true;

  const title = doc.createElement('h2');
  title.className = 'callout__title';
  title.setAttribute('data-testid', 'callout-title');

  const description = doc.createElement('p');
  description.className = 'callout__description';
  description.setAttribute('data-testid', 'callout-description');
  description.hidden = true;

  const facts = doc.createElement('ul');
  facts.className = 'callout__facts';
  facts.setAttribute('data-testid', 'callout-facts');
  facts.hidden = true;

  element.appendChild(closeButton);
  element.appendChild(eyebrow);
  element.appendChild(title);
  element.appendChild(description);
  element.appendChild(facts);
  options.container.appendChild(element);

  let open = false;

  return {
    element,
    get isOpen(): boolean {
      return open;
    },
    show(content: CalloutContent): void {
      eyebrow.textContent = content.eyebrow ?? '';
      eyebrow.hidden = content.eyebrow === undefined || content.eyebrow === '';

      title.textContent = content.title;

      description.textContent = content.description ?? '';
      description.hidden = description.textContent === '';

      facts.replaceChildren();
      for (const fact of content.facts ?? []) {
        const item = doc.createElement('li');
        item.className = 'callout__fact';
        item.textContent = fact;
        facts.appendChild(item);
      }
      facts.hidden = facts.childElementCount === 0;

      if (content.accent) {
        element.style.setProperty('--callout-accent', content.accent);
      } else {
        element.style.removeProperty('--callout-accent');
      }

      element.classList.add('is-open');
      element.setAttribute('aria-hidden', 'false');
      open = true;
    },
    hide(): void {
      element.classList.remove('is-open');
      element.setAttribute('aria-hidden', 'true');
      open = false;
    },
    dispose(): void {
      closeButton.removeEventListener('click', handleClose);
      element.remove();
      open = false;
    },
  };
}
