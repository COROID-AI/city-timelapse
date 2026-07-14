// Full-screen loading overlay shown during init. Removed once the scene is ready.

export class LoadingScreen {
  private el: HTMLDivElement;
  private bar: HTMLDivElement;
  private label: HTMLDivElement;
  private destroyed = false;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'loading-screen';
    this.el.innerHTML = `
      <div class="loading-inner">
        <div class="loading-title">City Era Timelapse</div>
        <div class="loading-sub">1945 → 2055</div>
        <div class="loading-track"><div class="loading-bar"></div></div>
        <div class="loading-label">Initializing scene…</div>
      </div>`;
    container.appendChild(this.el);
    this.bar = this.el.querySelector('.loading-bar') as HTMLDivElement;
    this.label = this.el.querySelector('.loading-label') as HTMLDivElement;
  }

  setProgress(p: number, text?: string): void {
    if (this.destroyed) return;
    this.bar.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
    if (text) this.label.textContent = text;
  }

  hide(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.el.classList.add('hidden');
    window.setTimeout(() => this.el.remove(), 600);
  }
}
