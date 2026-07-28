/**
 * Timeline UI component.
 * Renders a horizontal timeline slider at the top of the screen
 * with era buttons for 1945, 1965, 1985, 2005, 2025, 2055.
 */
import type { EraId } from '../eras';
import { ERA_REGISTRY } from '../eras';
import { stateStore } from '../state';

export class TimelineUI {
  private container: HTMLElement;
  private onSelect: (era: EraId) => void;
  private currentEra: EraId;
  private buttons: Map<EraId, HTMLButtonElement> = new Map();
  private slider: HTMLInputElement;
  private label: HTMLElement;

  constructor(container: HTMLElement, onSelect: (era: EraId) => void, initialEra: EraId) {
    this.container = container;
    this.onSelect = onSelect;
    this.currentEra = initialEra;

    this.render();
    this.slider = this.container.querySelector('#timeline-slider') as HTMLInputElement;
    this.label = this.container.querySelector('#era-label') as HTMLElement;

    this.setupEventListeners();
    this.update(initialEra);
  }

  private render(): void {
    const years = ERA_REGISTRY.map(e => e.year);

    this.container.innerHTML = `
      <div class="timeline-container">
        <div class="timeline-header">
          <span class="era-title">City Era Timelapse</span>
          <span id="era-label" class="era-label">${this.currentEra}</span>
        </div>
        <div class="timeline-slider-wrapper">
          <input
            id="timeline-slider"
            type="range"
            min="0"
            max="${years.length - 1}"
            step="1"
            value="${ERA_REGISTRY.findIndex(e => e.id === this.currentEra)}"
            aria-label="Select era"
            role="slider"
          />
          <div class="timeline-ticks">
            ${years.map(y => `<span class="tick">${y}</span>`).join('')}
          </div>
        </div>
        <div class="era-buttons">
          ${ERA_REGISTRY.map(e => `
            <button
              data-era="${e.id}"
              class="era-button ${e.id === this.currentEra ? 'active' : ''}"
              aria-label="Select era ${e.year}"
            >
              <span class="era-year">${e.year}</span>
              <span class="era-desc">${e.description}</span>
            </button>
          `).join('')}
        </div>
        <div class="audio-controls">
          <button id="mute-btn" class="audio-btn" aria-label="Toggle mute">🔊</button>
          <div class="volume-control">
            <input id="volume-slider" type="range" min="0" max="100" step="1" value="70" aria-label="Volume" />
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();
  }

  private addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .timeline-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        padding: 16px 24px;
        z-index: 1000;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .era-title {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
      }
      .era-label {
        font-size: 20px;
        font-weight: 700;
        color: #00ffff;
        text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
      }
      .timeline-slider-wrapper {
        position: relative;
        margin-bottom: 16px;
      }
      #timeline-slider {
        width: 100%;
        height: 8px;
        -webkit-appearance: none;
        background: transparent;
        outline: none;
        cursor: pointer;
      }
      #timeline-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #00ffff;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
        border: 2px solid #fff;
        transition: all 0.2s;
      }
      #timeline-slider::-moz-range-thumb {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #00ffff;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
        border: 2px solid #fff;
      }
      .timeline-ticks {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }
      .era-buttons {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      .era-button {
        flex: 1;
        min-width: 100px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: #fff;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
        text-align: center;
      }
      .era-button:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-2px);
      }
      .era-button.active {
        background: rgba(0, 255, 255, 0.2);
        border-color: #00ffff;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
      }
      .era-year {
        font-weight: 700;
        display: block;
        font-size: 14px;
      }
      .era-desc {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.7);
      }
      .audio-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .audio-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: #fff;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 16px;
      }
      .audio-btn:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      .volume-control {
        flex: 1;
      }
      #volume-slider {
        width: 100%;
        height: 6px;
        -webkit-appearance: none;
        background: rgba(255, 255, 255, 0.2);
        outline: none;
        border-radius: 3px;
      }
      #volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #00ffff;
        cursor: pointer;
      }
      #volume-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #00ffff;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  private setupEventListeners(): void {
    // Slider change
    this.slider.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const index = parseInt(target.value, 10);
      const era = ERA_REGISTRY[index]?.id;
      if (era) {
        this.onSelect(era);
      }
    });

    // Era buttons
    const buttons = this.container.querySelectorAll('.era-button');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const era = btn.getAttribute('data-era') as EraId;
        if (era) {
          this.onSelect(era);
        }
      });
    });

    // Mute button
    const muteBtn = this.container.querySelector('#mute-btn') as HTMLButtonElement;
    muteBtn.addEventListener('click', () => {
      stateStore.setMuted(!stateStore.getState().muted);
    });

    // Volume slider
    const volumeSlider = this.container.querySelector('#volume-slider') as HTMLInputElement;
    volumeSlider.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      stateStore.setVolume(parseInt(target.value, 10) / 100);
    });
  }

  update(era: EraId): void {
    this.currentEra = era;
    this.label.textContent = era;

    // Update slider
    const index = ERA_REGISTRY.findIndex(e => e.id === era);
    this.slider.value = String(index);

    // Update active button
    this.buttons.forEach((btn, id) => {
      btn.classList.toggle('active', id === era);
    });

    // Rebuild buttons for active state
    const buttons = this.container.querySelectorAll('.era-button');
    buttons.forEach(btn => {
      const eraId = btn.getAttribute('data-era') as EraId;
      btn.classList.toggle('active', eraId === era);
    });
  }
}
