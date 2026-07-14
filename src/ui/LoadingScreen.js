// Full-screen loading overlay with a progress bar; fades out when ready.
export class LoadingScreen {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'loading';
    this.element.innerHTML = `
      <div class="title">City Era Timelapse</div>
      <div class="sub">Building the city…</div>
      <div class="bar-wrap"><div class="bar-fill"></div></div>
      <div class="pct">0%</div>
    `;
    this.fillEl = this.element.querySelector('.bar-fill');
    this.pctEl = this.element.querySelector('.pct');
  }

  setProgress(p) {
    const v = Math.round(Math.min(1, Math.max(0, p)) * 100);
    this.fillEl.style.width = `${v}%`;
    this.pctEl.textContent = `${v}%`;
  }

  hide() {
    this.setProgress(1);
    setTimeout(() => this.element.classList.add('hidden'), 200);
  }
}
