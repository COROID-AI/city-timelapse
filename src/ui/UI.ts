import type { Experience } from '../Experience';
import { ERA_IDS, ERA_YEARS } from '../types';
import type { EraId } from '../types';

interface UIElements {
  timeline: HTMLDivElement;
  eraButtons: HTMLButtonElement[];
  slider: HTMLInputElement;
  sliderLabel: HTMLSpanElement;
  eraNow: HTMLSpanElement;
  audioBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  loader: HTMLDivElement;
}

/**
 * Builds and wires the entire DOM UI: the top timeline (6 era buttons + a
 * continuous slider), the HUD (audio toggle + reset), keyboard shortcuts, and
 * the loader overlay. All interactive elements are keyboard-focusable with a
 * visible focus ring.
 */
export class UI {
  private exp: Experience;
  private el: UIElements;
  private audioOn = false;

  constructor(exp: Experience) {
    this.exp = exp;
    this.el = this.buildDOM();
    this.wireEvents();
    this.updateActiveEra('1945');
  }

  /** Mark the loader as faded out (call after first frame). */
  hideLoader(): void {
    this.el.loader.classList.add('fade');
    setTimeout(() => this.el.loader.classList.add('hidden'), 200);
  }

  // --------------------------------------------------------------------
  // DOM construction
  // --------------------------------------------------------------------

  private buildDOM(): UIElements {
    // --- Title card (top-left) ---
    const title = document.createElement('div');
    title.id = 'title-card';
    title.innerHTML = `
      <h1>City Timelapse</h1>
      <div class="sub">1945 → 2055 · drag to orbit · scroll to zoom · right-drag to pan</div>
    `;
    document.body.appendChild(title);

    // --- Timeline (top centre) ---
    const timeline = document.createElement('div');
    timeline.id = 'timeline';
    timeline.setAttribute('role', 'toolbar');
    timeline.setAttribute('aria-label', 'Era timeline');

    const titleRow = document.createElement('div');
    titleRow.className = 'timeline-title';
    const titleLeft = document.createElement('span');
    titleLeft.textContent = 'Select an era';
    const eraNow = document.createElement('span');
    eraNow.className = 'era-now';
    eraNow.textContent = '1945';
    titleRow.appendChild(titleLeft);
    titleRow.appendChild(eraNow);
    timeline.appendChild(titleRow);

    const eraButtonsDiv = document.createElement('div');
    eraButtonsDiv.className = 'era-buttons';
    const eraButtons: HTMLButtonElement[] = [];
    for (const id of ERA_IDS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'era-btn';
      btn.textContent = String(ERA_YEARS[id]);
      btn.dataset.era = id;
      btn.setAttribute('aria-label', `Go to year ${ERA_YEARS[id]}`);
      btn.setAttribute('aria-pressed', 'false');
      eraButtons.push(btn);
      eraButtonsDiv.appendChild(btn);
    }
    timeline.appendChild(eraButtonsDiv);

    // Slider
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'slider-wrap';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '5';
    slider.step = '0.01';
    slider.value = '0';
    slider.setAttribute('aria-label', 'Timeline scrubber');
    slider.setAttribute('aria-valuemin', '1945');
    slider.setAttribute('aria-valuemax', '2055');
    const sliderLabel = document.createElement('span');
    sliderLabel.className = 'slider-label';
    sliderLabel.textContent = '1945';
    sliderWrap.appendChild(slider);
    sliderWrap.appendChild(sliderLabel);
    timeline.appendChild(sliderWrap);

    document.body.appendChild(timeline);

    // --- HUD bottom-left: reset ---
    const hud = document.createElement('div');
    hud.id = 'hud';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'hud-btn';
    resetBtn.id = 'reset-btn';
    resetBtn.innerHTML = `Reset view <kbd>R</kbd>`;
    resetBtn.setAttribute('aria-label', 'Reset camera view');
    hud.appendChild(resetBtn);
    document.body.appendChild(hud);

    // --- HUD bottom-right: audio ---
    const hudRight = document.createElement('div');
    hudRight.id = 'hud-right';
    const audioBtn = document.createElement('button');
    audioBtn.type = 'button';
    audioBtn.className = 'hud-btn';
    audioBtn.id = 'audio-btn';
    audioBtn.setAttribute('aria-pressed', 'false');
    audioBtn.innerHTML = `<span class="dot"></span> Sound off`;
    audioBtn.setAttribute('aria-label', 'Toggle ambient sound');
    hudRight.appendChild(audioBtn);
    document.body.appendChild(hudRight);

    // --- Loader ---
    const loader = document.createElement('div');
    loader.id = 'loader';
    loader.innerHTML = `
      <div class="loader-inner">
        <div class="spinner"></div>
        <span>Building the city…</span>
      </div>
    `;
    document.body.appendChild(loader);

    return {
      timeline,
      eraButtons,
      slider,
      sliderLabel,
      eraNow,
      audioBtn,
      resetBtn,
      loader,
    };
  }

  // --------------------------------------------------------------------
  // Event wiring
  // --------------------------------------------------------------------

  private wireEvents(): void {
    // Era buttons
    for (const btn of this.el.eraButtons) {
      btn.addEventListener('click', () => {
        const id = btn.dataset.era as EraId;
        this.selectEra(id, /* fromGesture */ true);
      });
    }

    // Slider
    this.el.slider.addEventListener('input', () => {
      const v = parseFloat(this.el.slider.value);
      this.exp.setSliderProgress(v);
      this.syncSliderLabel(v);
      // Snap nearest era button highlight
      const nearest = ERA_IDS[Math.round(v)];
      this.updateActiveEra(nearest);
      // Slider interaction counts as a gesture → may start audio if previously on
      if (this.audioOn) this.ensureAudio(this.exp.getCurrentEraId());
    });

    // Audio toggle (gesture)
    this.el.audioBtn.addEventListener('click', () => {
      this.audioOn = !this.audioOn;
      if (this.audioOn) {
        this.ensureAudio(this.exp.getCurrentEraId());
      } else {
        this.exp.audio.setMuted(true);
      }
      this.updateAudioBtn();
    });

    // Reset
    this.el.resetBtn.addEventListener('click', () => {
      this.exp.resetCamera();
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === 'r') {
        this.exp.resetCamera();
      } else if (key === 'm') {
        this.el.audioBtn.click();
      } else if (key >= '1' && key <= '6') {
        const idx = parseInt(key, 10) - 1;
        this.selectEra(ERA_IDS[idx], true);
      }
    });
  }

  /** Select an era: update experience + UI, and start/refresh audio on gesture. */
  private selectEra(id: EraId, fromGesture: boolean): void {
    this.exp.goToEra(id);
    this.updateActiveEra(id);
    this.el.slider.value = String(ERA_IDS.indexOf(id));
    this.syncSliderLabel(ERA_IDS.indexOf(id));
    if (fromGesture && this.audioOn) {
      this.ensureAudio(id);
    } else if (fromGesture) {
      // First-ever gesture on an era: auto-enable audio (AC: begins after gesture)
      this.audioOn = true;
      this.ensureAudio(id);
      this.updateAudioBtn();
    }
  }

  /** Create/resume AudioContext inside the gesture, then set era bed. */
  private ensureAudio(id: EraId): void {
    void this.exp.audio.start(id).then(() => {
      this.exp.audio.setEra(id);
      this.exp.audio.setMuted(false);
    });
  }

  private updateAudioBtn(): void {
    const btn = this.el.audioBtn;
    btn.setAttribute('aria-pressed', String(this.audioOn));
    btn.innerHTML = `<span class="dot"></span> Sound ${this.audioOn ? 'on' : 'off'}`;
    btn.classList.toggle('on', this.audioOn);
  }

  private updateActiveEra(id: EraId): void {
    for (const btn of this.el.eraButtons) {
      const active = btn.dataset.era === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    this.el.eraNow.textContent = String(ERA_YEARS[id]);
  }

  private syncSliderLabel(v: number): void {
    const idx = Math.round(v);
    const lo = ERA_IDS[Math.floor(v)] ?? '1945';
    const yearLo = ERA_YEARS[lo];
    const yearHi = ERA_YEARS[ERA_IDS[Math.min(5, Math.floor(v) + 1)] ?? '2055'];
    const frac = v - Math.floor(v);
    const year = Math.round(yearLo + (yearHi - yearLo) * frac);
    void idx;
    this.el.sliderLabel.textContent = String(year);
  }
}
