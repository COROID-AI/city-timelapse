import { ERAS, ERA_COUNT } from '../config/eras';

// ============================================================================
// DOM UI overlay — vanilla, no React. Timeline slider (top), playback controls
// (Play/Pause/Loop), sound toggle, era label, and raycast info card.
// Keyboard: 1-6 eras, Space play/pause, R auto-rotate, M mute.
// ============================================================================

export interface UICallbacks {
  onEraChange: (index: number) => void;
  onPlayToggle: () => void;
  onLoopToggle: (on: boolean) => void;
  onSoundToggle: () => void;
  onAutoRotateToggle: () => void;
  onBuildingInfo: (info: BuildingCardData | null) => void;
  onFirstGesture: () => void;
}

export interface BuildingCardData {
  name: string;
  year: number;
  style: string;
  height: number;
  floors: number;
  description: string;
}

export class UI {
  private cb: UICallbacks;
  private root: HTMLElement;
  private sliderTrack: HTMLElement;
  private sliderHandle: HTMLElement;
  private eraButtons: HTMLElement[] = [];
  private playBtn: HTMLButtonElement;
  private loopBtn: HTMLButtonElement;
  private soundBtn: HTMLButtonElement;
  private rotateBtn: HTMLButtonElement;
  private eraLabel: HTMLElement;
  private eraTagline: HTMLElement;
  private infoCard: HTMLElement;
  private infoContent: HTMLElement;
  private infoClose: HTMLButtonElement;
  private helpHint: HTMLElement;

  private currentEra = 0;
  private isPlaying = false;
  private isLooping = true;
  private soundOn = false;
  private autoRotate = false;
  private dragging = false;

  constructor(cb: UICallbacks) {
    this.cb = cb;
    this.root = document.getElementById('ui-root')!;

    this.build();
    this.sliderTrack = document.getElementById('slider-track')!;
    this.sliderHandle = document.getElementById('slider-handle')!;
    this.playBtn = document.getElementById('btn-play') as HTMLButtonElement;
    this.loopBtn = document.getElementById('btn-loop') as HTMLButtonElement;
    this.soundBtn = document.getElementById('btn-sound') as HTMLButtonElement;
    this.rotateBtn = document.getElementById('btn-rotate') as HTMLButtonElement;
    this.eraLabel = document.getElementById('era-label')!;
    this.eraTagline = document.getElementById('era-tagline')!;
    this.infoCard = document.getElementById('info-card')!;
    this.infoContent = document.getElementById('info-content')!;
    this.infoClose = document.getElementById('info-close') as HTMLButtonElement;
    this.helpHint = document.getElementById('help-hint')!;
    this.eraButtons = Array.from(document.querySelectorAll('.era-btn'));

    this.bind();
    this.setEra(0, true);
  }

  private build(): void {
    this.root.innerHTML = `
      <div id="top-bar">
        <div id="brand">
          <div id="brand-title">CITY TIMELAPSE</div>
          <div id="brand-sub">1945 → 2055</div>
        </div>
        <div id="timeline-wrap">
          <div id="slider-track">
            <div id="slider-fill"></div>
            <div id="slider-handle"></div>
            <div id="era-ticks">
              ${ERAS.map((e, i) => `<button class="era-btn" data-era="${i}"><span class="era-year">${e.label}</span></button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div id="era-display">
        <div id="era-label">1945</div>
        <div id="era-tagline">Postwar — brick & resolve</div>
      </div>

      <div id="controls">
        <button id="btn-play" class="ctrl-btn" title="Play/Pause (Space)">
          <span class="icon-play">▶</span><span class="icon-pause" style="display:none">❚❚</span>
          <span class="ctrl-label">Play</span>
        </button>
        <button id="btn-loop" class="ctrl-btn active" title="Loop timelapse">
          <span class="icon">↻</span><span class="ctrl-label">Loop</span>
        </button>
        <button id="btn-rotate" class="ctrl-btn" title="Auto-rotate (R)">
          <span class="icon">⟳</span><span class="ctrl-label">Rotate</span>
        </button>
        <button id="btn-sound" class="ctrl-btn" title="Sound (M)">
          <span class="icon-mute">🔇</span><span class="icon-sound" style="display:none">🔊</span>
          <span class="ctrl-label">Sound</span>
        </button>
      </div>

      <div id="info-card" style="display:none">
        <button id="info-close">✕</button>
        <div id="info-content"></div>
      </div>

      <div id="help-hint">Drag to orbit · Right-drag to pan · Wheel to zoom · Click buildings for info · Keys 1–6, Space, R, M</div>
    `;
  }

  private bind(): void {
    // Slider handle drag
    const onPointerDown = (e: PointerEvent) => {
      this.dragging = true;
      this.sliderHandle.setPointerCapture(e.pointerId);
      this.handlePointer(e);
      this.cb.onFirstGesture();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (this.dragging) this.handlePointer(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (this.dragging) {
        this.dragging = false;
        this.handlePointer(e, true);
      }
    };
    this.sliderTrack.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Era buttons
    this.eraButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.era!);
        this.cb.onFirstGesture();
        this.setEra(idx);
        this.cb.onEraChange(idx);
      });
    });

    // Buttons
    this.playBtn.addEventListener('click', () => { this.cb.onFirstGesture(); this.cb.onPlayToggle(); });
    this.loopBtn.addEventListener('click', () => { this.cb.onFirstGesture(); this.cb.onLoopToggle(!this.isLooping); });
    this.rotateBtn.addEventListener('click', () => { this.cb.onFirstGesture(); this.cb.onAutoRotateToggle(); });
    this.soundBtn.addEventListener('click', () => { this.cb.onFirstGesture(); this.cb.onSoundToggle(); });
    this.infoClose.addEventListener('click', () => { this.hideInfo(); this.cb.onBuildingInfo(null); });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k >= '1' && k <= '6') {
        const idx = parseInt(k) - 1;
        if (idx < ERA_COUNT) {
          this.cb.onFirstGesture();
          this.setEra(idx);
          this.cb.onEraChange(idx);
        }
      } else if (k === ' ') {
        e.preventDefault();
        this.cb.onFirstGesture();
        this.cb.onPlayToggle();
      } else if (k === 'r' || k === 'R') {
        this.cb.onFirstGesture();
        this.cb.onAutoRotateToggle();
      } else if (k === 'm' || k === 'M') {
        this.cb.onFirstGesture();
        this.cb.onSoundToggle();
      }
    });
  }

  private handlePointer(e: PointerEvent, snap = false): void {
    const rect = this.sliderTrack.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    // snap to nearest era
    let idx = Math.round(x * (ERA_COUNT - 1));
    idx = clamp(idx, 0, ERA_COUNT - 1);
    if (idx !== this.currentEra || snap) {
      this.setEra(idx);
      this.cb.onEraChange(idx);
    } else {
      this.updateSliderVisual();
    }
  }

  setEra(index: number, silent = false): void {
    this.currentEra = clamp(index, 0, ERA_COUNT - 1);
    this.updateSliderVisual();
    this.updateEraDisplay();
    this.eraButtons.forEach((btn, i) => {
      btn.classList.toggle('active', i === this.currentEra);
    });
    if (!silent) void 0;
  }

  private updateSliderVisual(): void {
    const pct = (this.currentEra / (ERA_COUNT - 1)) * 100;
    this.sliderHandle.style.left = `${pct}%`;
    (document.getElementById('slider-fill') as HTMLElement)!.style.width = `${pct}%`;
  }

  private updateEraDisplay(): void {
    const era = ERAS[this.currentEra];
    this.eraLabel.textContent = era.label;
    this.eraTagline.textContent = era.tagline;
  }

  setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    (this.playBtn.querySelector('.icon-play') as HTMLElement).style.display = playing ? 'none' : '';
    (this.playBtn.querySelector('.icon-pause') as HTMLElement).style.display = playing ? '' : 'none';
    (this.playBtn.querySelector('.ctrl-label') as HTMLElement).textContent = playing ? 'Pause' : 'Play';
  }

  setLooping(on: boolean): void {
    this.isLooping = on;
    this.loopBtn.classList.toggle('active', on);
  }

  setSoundOn(on: boolean): void {
    this.soundOn = on;
    (this.soundBtn.querySelector('.icon-mute') as HTMLElement).style.display = on ? 'none' : '';
    (this.soundBtn.querySelector('.icon-sound') as HTMLElement).style.display = on ? '' : 'none';
    this.soundBtn.classList.toggle('active', on);
  }

  setAutoRotate(on: boolean): void {
    this.autoRotate = on;
    this.rotateBtn.classList.toggle('active', on);
  }

  showInfo(info: BuildingCardData): void {
    this.infoContent.innerHTML = `
      <div class="info-name">${info.name}</div>
      <div class="info-year">${info.year}</div>
      <div class="info-row"><span class="info-key">Style</span><span class="info-val">${info.style}</span></div>
      <div class="info-row"><span class="info-key">Height</span><span class="info-val">${info.height} m · ${info.floors} floors</span></div>
      <div class="info-desc">${info.description}</div>
    `;
    this.infoCard.style.display = '';
  }

  hideInfo(): void {
    this.infoCard.style.display = 'none';
  }

  hideLoader(): void {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 600);
    }
  }

  fadeHelpHint(): void {
    setTimeout(() => this.helpHint.classList.add('faded'), 8000);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
