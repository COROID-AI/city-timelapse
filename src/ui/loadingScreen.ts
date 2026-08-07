/**
 * Full-screen loading overlay shown while the initial era assets build.
 *
 * The overlay is present in the DOM from page load (see index.html) and stays
 * visible until the first frame is rendered, guaranteeing it is on screen
 * during the synchronous initial-era build. {@link hide} fades it out and then
 * removes it from the DOM.
 */
export class LoadingScreen {
  private readonly el: HTMLElement | null;
  private hidden = false;

  constructor(id = 'loading-screen') {
    this.el = document.getElementById(id);
  }

  /** Fade out and remove the loading overlay (idempotent). */
  hide(): void {
    if (!this.el || this.hidden) {
      return;
    }
    this.hidden = true;
    this.el.classList.add('is-hidden');
    window.setTimeout(() => {
      if (this.el?.parentElement) {
        this.el.parentElement.removeChild(this.el);
      }
    }, 600);
  }
}
