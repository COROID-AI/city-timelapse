/**
 * Overlay UI: loading screen, fallback screen, and the accessible era
 * description readout. All are semantic DOM elements outside the canvas.
 */
import { EraId, getEraSpecOr } from '../eras';

export class Overlay {
  private readonly loading: HTMLDivElement;
  private readonly eraDesc: HTMLDivElement;
  private readonly fallback: HTMLDivElement | null = null;

  constructor() {
    // Loading screen.
    this.loading = document.createElement('div');
    this.loading.className = 'overlay-loading';
    this.loading.textContent = 'Building the city…';
    document.body.appendChild(this.loading);

    // Era description readout (screen-reader + visible chip).
    this.eraDesc = document.createElement('div');
    this.eraDesc.className = 'era-desc';
    this.eraDesc.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.eraDesc);
  }

  /** Hide the loading screen once the first frame is ready. */
  hideLoading(): void {
    this.loading.classList.add('hidden');
    window.setTimeout(() => {
      this.loading.remove();
    }, 400);
  }

  /** Update the era description chip. */
  setEra(id: EraId): void {
    const spec = getEraSpecOr(id);
    this.eraDesc.textContent = `${spec.label} — ${spec.description}`;
  }

  /** Show a fallback when WebGL is unavailable. */
  showFallback(message: string): void {
    const el = document.createElement('div');
    el.className = 'overlay-fallback';
    el.textContent = message;
    document.body.appendChild(el);
  }

  dispose(): void {
    this.loading.remove();
    this.eraDesc.remove();
    this.fallback?.remove();
  }
}