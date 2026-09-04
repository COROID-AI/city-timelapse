/**
 * Timeline UI: the top timeline slider with the 5 era stops (1945–2025),
 * era buttons, mute toggle, quality selector and help overlay. All controls
 * are semantic DOM elements with visible focus states and keyboard
 * operability (arrow keys move between era stops).
 */
import { EraId, ERA_IDS, getEraSpec } from '../eras';
import { AppState } from '../state';

export interface TimelineCallbacks {
  onEraSelect(era: EraId): void;
  onMuteToggle(muted: boolean): void;
  onQualityChange(quality: number): void;
}

export class TimelineUi {
  readonly root: HTMLDivElement;
  private readonly slider: HTMLInputElement;
  private readonly eraButtons: HTMLButtonElement[] = [];
  private readonly muteBtn: HTMLButtonElement;
  private readonly helpBtn: HTMLButtonElement;
  private readonly helpPanel: HTMLDivElement;
  private readonly qualBtn: HTMLButtonElement;
  private readonly callbacks: TimelineCallbacks;

  constructor(callbacks: TimelineCallbacks) {
    this.callbacks = callbacks;
    this.root = document.createElement('div');
    this.root.className = 'timeline-ui';

    const topBar = document.createElement('div');
    topBar.className = 'top-bar';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'CITY TIMELAPSE';
    topBar.appendChild(title);

    // Timeline slider.
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'slider-wrap';
    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = String(ERA_IDS.length - 1);
    this.slider.step = '1';
    this.slider.value = '0';
    this.slider.className = 'era-slider';
    this.slider.setAttribute('aria-label', 'Timeline year');
    this.slider.addEventListener('input', () => {
      const idx = parseInt(this.slider.value, 10);
      const era = ERA_IDS[Math.max(0, Math.min(ERA_IDS.length - 1, idx))];
      this.callbacks.onEraSelect(era);
    });
    // Keyboard: arrow keys move between the 5 discrete stops.
    this.slider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const current = parseInt(this.slider.value, 10);
        let next = current;
        if (e.key === 'ArrowLeft') next = Math.max(0, current - 1);
        else if (e.key === 'ArrowRight') next = Math.min(ERA_IDS.length - 1, current + 1);
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = ERA_IDS.length - 1;
        this.slider.value = String(next);
        this.callbacks.onEraSelect(ERA_IDS[next]);
      }
    });
    sliderWrap.appendChild(this.slider);

    // Era labels under the slider.
    const labels = document.createElement('div');
    labels.className = 'era-labels';
    for (const id of ERA_IDS) {
      const span = document.createElement('span');
      span.textContent = id;
      span.dataset.era = id;
      span.addEventListener('click', () => this.callbacks.onEraSelect(id));
      labels.appendChild(span);
    }
    sliderWrap.appendChild(labels);
    topBar.appendChild(sliderWrap);

    // Control buttons.
    const controls = document.createElement('div');
    controls.className = 'controls';

    this.muteBtn = document.createElement('button');
    this.muteBtn.className = 'ctrl-btn';
    this.muteBtn.textContent = '🔇 Mute';
    this.muteBtn.addEventListener('click', () => {
      const muted = !this.muteBtn.classList.contains('active');
      this.muteBtn.classList.toggle('active', muted);
      this.muteBtn.textContent = muted ? '🔊 Unmute' : '🔇 Mute';
      this.callbacks.onMuteToggle(muted);
    });
    controls.appendChild(this.muteBtn);

    this.qualBtn = document.createElement('button');
    this.qualBtn.className = 'ctrl-btn';
    this.qualBtn.textContent = '⚙ Quality: High';
    this.qualBtn.addEventListener('click', () => {
      const next = (parseInt(this.qualBtn.dataset.quality ?? '0', 10) + 1) % 3;
      this.qualBtn.dataset.quality = String(next);
      const labels = ['High', 'Balanced', 'Low'];
      this.qualBtn.textContent = `⚙ Quality: ${labels[next]}`;
      this.callbacks.onQualityChange(next);
    });
    controls.appendChild(this.qualBtn);

    this.helpBtn = document.createElement('button');
    this.helpBtn.className = 'ctrl-btn';
    this.helpBtn.textContent = '❓ Help';
    this.helpBtn.addEventListener('click', () => {
      this.helpPanel.classList.toggle('open');
    });
    controls.appendChild(this.helpBtn);

    topBar.appendChild(controls);
    this.root.appendChild(topBar);

    // Era buttons row.
    const eraRow = document.createElement('div');
    eraRow.className = 'era-buttons';
    for (const id of ERA_IDS) {
      const btn = document.createElement('button');
      btn.className = 'era-btn';
      btn.textContent = id;
      btn.addEventListener('click', () => this.callbacks.onEraSelect(id));
      this.eraButtons.push(btn);
      eraRow.appendChild(btn);
    }
    this.root.appendChild(eraRow);

    // Help panel.
    this.helpPanel = document.createElement('div');
    this.helpPanel.className = 'help-panel';
    const helpText = document.createElement('p');
    helpText.textContent = 'Drag to orbit · Scroll to zoom · Right-drag to pan · Use the timeline to travel through time.';
    this.helpPanel.appendChild(helpText);
    const eraList = document.createElement('ul');
    for (const id of ERA_IDS) {
      const li = document.createElement('li');
      li.textContent = `${getEraSpec(id).label} — ${getEraSpec(id).description}`;
      eraList.appendChild(li);
    }
    this.helpPanel.appendChild(eraList);
    this.root.appendChild(this.helpPanel);

    document.body.appendChild(this.root);
  }

  /** Reflect the current era in the slider + buttons. */
  sync(state: AppState): void {
    const idx = ERA_IDS.indexOf(state.era);
    if (idx >= 0) {
      this.slider.value = String(idx);
    }
    for (let i = 0; i < this.eraButtons.length; i++) {
      this.eraButtons[i].classList.toggle('active', i === idx);
    }
  }

  dispose(): void {
    this.root.remove();
  }
}