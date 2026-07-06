import * as THREE from 'three';
import { EraId } from '../eras.js';
import { emitEraChanged } from './timeline-events';

class TimelineSlider {
  private container!: HTMLElement;
  private input!: HTMLInputElement;
  private loadingIndicator!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initUI();
  }

  private initUI(): void {
    // Create loading indicator
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.id = 'loading';
    this.loadingIndicator.style.display = 'none';
    this.container.appendChild(this.loadingIndicator);

    // Create slider container
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'timeline-slider-container';
    sliderContainer.innerHTML = `
      <div class="timeline-tick-marks">
        <div class="timeline-tick" data-year="1945"></div>
        <div class="timeline-tick" data-year="1965"></div>
        <div class="timeline-tick" data-year="1985"></div>
        <div class="timeline-tick" data-year="2005"></div>
        <div class="timeline-tick" data-year="2025"></div>
      </div>
    `;
    this.container.appendChild(sliderContainer);

    // Create and configure slider input
    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.min = '0';
    this.input.max = '4';
    this.input.value = '0';
    this.input.step = '1';
    this.input.addEventListener('input', this.handleInputChange);
    sliderContainer.appendChild(this.input);

    // Add era labels
    const labels = sliderContainer.querySelectorAll('.timeline-tick');n const eraLabels = {
      '1945': { label: '1945', desc: 'World War II Era' },
      '1965': { label: '1965', desc: 'Cold War Era' },
      '1985': { label: '1985', desc: 'Digital Revolution' },
      '2005': { label: '2005', desc: 'Information Age' },
      '2025': { label: '2025', desc: 'Future Projections' }
    };

    labels.forEach(label => {
      const year = label.dataset.year;
      const labelDiv = document.createElement('div');
      labelDiv.className = 'timeline-era-label';
      labelDiv.textContent = eraLabels[year].label;
      label.insertAdjacentElement('afterend', labelDiv);

      const descDiv = document.createElement('div');
      descDiv.className = 'timeline-era-description';
      descDiv.textContent = eraLabels[year].desc;
      label.insertAdjacentElement('afterend', descDiv);
    });
  }

  private handleInputChange = (event: Event): void => {
    const value = (event.target as HTMLInputElement).value;
    const year = ['1945', '1965', '1985', '2005', '2025'][Number(value)];n
    emitEraChanged({ era: year as EraId });
    this.updateLoadingIndicator();
  }

  private updateLoadingIndicator(): void {
    this.loadingIndicator.style.display = 'block';
    setTimeout(() => {
      this.loadingIndicator.style.display = 'none';
    }, 1500); // Simulate loading delay
  }
}

export function initTimelineSlider(container: HTMLElement): void {
  new TimelineSlider(container);
}

export function emitEraChanged(event: { era: EraId }): void {
  const event = new CustomEvent('era-changed', {
    detail: { era: event.era },
    bubbles: true,
    composed: true
  });
  window.dispatchEvent(event);
}</script>