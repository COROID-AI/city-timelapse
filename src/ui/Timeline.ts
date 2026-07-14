import { ERAS } from '../config/eras';

// Top timeline: slider input, era ticks, play/pause, prev/next, mute toggle.
// Emits era-index changes and playback state via callbacks.

export interface TimelineCallbacks {
  onEraChange: (index: number) => void;
  onScrub: (progress: number) => void;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onResetView: () => void;
  isPlaying: () => boolean;
  isMuted: () => boolean;
}

export class Timeline {
  private el: HTMLDivElement;
  private slider: HTMLInputElement;
  private ticks: HTMLDivElement;
  private playBtn: HTMLButtonElement;
  private muteBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;
  private label: HTMLDivElement;
  private desc: HTMLDivElement;
  private cb: TimelineCallbacks;

  constructor(container: HTMLElement, cb: TimelineCallbacks) {
    this.cb = cb;
    this.el = document.createElement('div');
    this.el.className = 'timeline';
    this.el.innerHTML = `
      <div class="timeline-top">
        <div class="era-readout">
          <div class="era-label">1945</div>
          <div class="era-desc">Post-war</div>
        </div>
        <div class="timeline-controls">
          <button class="btn btn-play" title="Play / Pause (Space)" aria-label="Play or pause">▶</button>
          <button class="btn btn-mute" title="Mute / Unmute (M)" aria-label="Mute or unmute">♪</button>
          <button class="btn btn-reset" title="Reset View (R)" aria-label="Reset view">⟲</button>
        </div>
      </div>
      <div class="timeline-slider-wrap">
        <input type="range" class="timeline-slider" min="0" max="${ERAS.length - 1}" step="0.001" value="0" aria-label="Era timeline" />
        <div class="timeline-ticks"></div>
      </div>`;
    container.appendChild(this.el);

    this.slider = this.el.querySelector('.timeline-slider') as HTMLInputElement;
    this.ticks = this.el.querySelector('.timeline-ticks') as HTMLDivElement;
    this.playBtn = this.el.querySelector('.btn-play') as HTMLButtonElement;
    this.muteBtn = this.el.querySelector('.btn-mute') as HTMLButtonElement;
    this.resetBtn = this.el.querySelector('.btn-reset') as HTMLButtonElement;
    this.label = this.el.querySelector('.era-label') as HTMLDivElement;
    this.desc = this.el.querySelector('.era-desc') as HTMLDivElement;

    this.buildTicks();
    this.bind();
  }

  private buildTicks(): void {
    for (let i = 0; i < ERAS.length; i++) {
      const tick = document.createElement('div');
      tick.className = 'tick';
      tick.style.left = `${(i / (ERAS.length - 1)) * 100}%`;
      tick.innerHTML = `<span class="tick-label">${ERAS[i].label}</span><span class="tick-mark"></span>`;
      tick.addEventListener('click', () => this.cb.onEraChange(i));
      this.ticks.appendChild(tick);
    }
  }

  private bind(): void {
    // While dragging, scrub continuously; on release snap to nearest era.
    this.slider.addEventListener('input', () => {
      const v = parseFloat(this.slider.value);
      this.cb.onScrub(v);
      this.updateReadout(v);
    });
    this.slider.addEventListener('change', () => {
      const v = Math.round(parseFloat(this.slider.value));
      this.slider.value = String(v);
      this.cb.onEraChange(v);
      this.updateReadout(v);
    });
    this.playBtn.addEventListener('click', () => {
      this.cb.onTogglePlay();
      this.updatePlayBtn();
    });
    this.muteBtn.addEventListener('click', () => {
      this.cb.onToggleMute();
      this.updateMuteBtn();
    });
    this.resetBtn.addEventListener('click', () => this.cb.onResetView());
  }

  setSliderValue(v: number): void {
    this.slider.value = String(v);
    this.updateReadout(v);
  }

  refreshButtons(): void {
    this.updatePlayBtn();
    this.updateMuteBtn();
  }

  private updatePlayBtn(): void {
    this.playBtn.textContent = this.cb.isPlaying() ? '❚❚' : '▶';
    this.playBtn.classList.toggle('active', this.cb.isPlaying());
  }

  private updateMuteBtn(): void {
    this.muteBtn.textContent = this.cb.isMuted() ? '♪̸' : '♪';
    this.muteBtn.classList.toggle('active', !this.cb.isMuted());
  }

  private updateReadout(v: number): void {
    const lo = Math.floor(v);
    const f = v - lo;
    const eraA = ERAS[Math.max(0, Math.min(ERAS.length - 1, lo))];
    const eraB = ERAS[Math.max(0, Math.min(ERAS.length - 1, lo + 1))];
    const year = Math.round(eraA.year + (eraB.year - eraA.year) * f);
    this.label.textContent = String(year);
    this.desc.textContent = f < 0.5 ? eraA.description : eraB.description;
    // Highlight nearest tick
    const nearest = Math.round(v);
    this.ticks.querySelectorAll('.tick').forEach((t, i) => {
      t.classList.toggle('current', i === nearest);
    });
  }
}
