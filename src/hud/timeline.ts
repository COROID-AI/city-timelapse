import { EraId } from '../eras.js';

/**
 * Timeline slider component that allows users to select historical eras
 */
class TimelineSlider {
  private container!: HTMLElement;
  private input!: HTMLInputElement;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    this.container = el;
    this.initUI();
  }

  private initUI(): void {
    // Create slider container
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'timeline-slider-container';
    sliderContainer.innerHTML = `
      <div class="timeline-era-label" id="era-label">1945</div>
      <div class="timeline-era-description" id="era-description">Post-War Era</div>
      <div class="timeline-tick-marks">
        <div class="timeline-tick active" data-year="1945" style="left: 0%;"></div>
        <div class="timeline-tick-label" style="left: 0%;">1945</div>
        <div class="timeline-tick" data-year="1965" style="left: 25%;"></div>
        <div class="timeline-tick-label" style="left: 25%;">1965</div>
        <div class="timeline-tick" data-year="1985" style="left: 50%;"></div>
        <div class="timeline-tick-label" style="left: 50%;">1985</div>
        <div class="timeline-tick" data-year="2005" style="left: 75%;"></div>
        <div class="timeline-tick-label" style="left: 75%;">2005</div>
        <div class="timeline-tick" data-year="2025" style="left: 100%;"></div>
        <div class="timeline-tick-label" style="left: 100%;">2025</div>
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
    this.input.className = 'timeline-slider';
    this.input.addEventListener('input', this.handleInputChange);
    sliderContainer.appendChild(this.input);
  }

  private handleInputChange = (event: Event): void => {
    const value = (event.target as HTMLInputElement).value;
    const years: EraId[] = ['1945', '1965', '1985', '2005', '2025'];
    const year = years[Number(value)];

    // Update UI labels
    const labelEl = document.getElementById('era-label');
    const descEl = document.getElementById('era-description');
    const eraLabels: Record<string, { label: string; desc: string }> = {
      '1945': { label: '1945', desc: 'Post-War Era' },
      '1965': { label: '1965', desc: 'Swinging Sixties' },
      '1985': { label: '1985', desc: 'Neon Eighties' },
      '2005': { label: '2005', desc: 'Digital Dawn' },
      '2025': { label: '2025', desc: 'Near Future' },
    };

    if (labelEl) labelEl.textContent = eraLabels[year].label;
    if (descEl) descEl.textContent = eraLabels[year].desc;

    // Update tick mark active state
    const ticks = this.container.querySelectorAll('.timeline-tick');
    ticks.forEach((tick, index) => {
      tick.classList.toggle('active', index === Number(value));
    });

    // Emit era change event
    this.emitEraChanged(year);
  };

  private emitEraChanged(era: EraId): void {
    const event = new CustomEvent('era-changed', {
      detail: { era },
      bubbles: true,
      composed: true,
    });
    window.dispatchEvent(event);
  }
}

/**
 * Initialize the timeline slider
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initTimelineSlider(_container: HTMLElement): void {
  // eslint-disable-next-line no-new
  new TimelineSlider('app');
}

/**
 * Alias for backward compatibility with main.ts import
 */
export { TimelineSlider };