import { EraId } from '../eras.js';

class TimelineSlider {
  private container!: HTMLElement;
  private input!: HTMLInputElement;
  private loadingIndicator!: HTMLElement;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id "${containerId}" not found`);
    }
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
    this.input.className = 'timeline-slider';
    this.input.addEventListener('input', this.handleInputChange);
    sliderContainer.appendChild(this.input);

    // Add era labels
    const labels = sliderContainer.querySelectorAll('.timeline-tick');
    const eraLabels: Record<string, { label: string; desc: string }> = {
      '1945': { label: '1945', desc: 'Post-War Era' },
      '1965': { label: '1965', desc: 'Swinging Sixties' },
      '1985': { label: '1985', desc: 'Neon Eighties' },
      '2005': { label: '2005', desc: 'Digital Dawn' },
      '2025': { label: '2025', desc: 'Near Future' }
    };

    labels.forEach(label => {
      const year = label.getAttribute('data-year');
      if (year && eraLabels[year]) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'timeline-era-label';
        labelDiv.textContent = eraLabels[year].label;
        label.insertAdjacentElement('afterend', labelDiv);

        const descDiv = document.createElement('div');
        descDiv.className = 'timeline-era-description';
        descDiv.textContent = eraLabels[year].desc;
        label.insertAdjacentElement('afterend', descDiv);
      }
    });

    // Add tick labels
    const tickMarks = sliderContainer.querySelector('.timeline-tick-marks');
    if (tickMarks) {
      const tickLabelPositions = [0, 25, 50, 75, 100];
      const years = ['1945', '1965', '1985', '2005', '2025'];
      
      years.forEach((year, index) => {
        const tickLabel = document.createElement('div');
        tickLabel.className = 'timeline-tick-label';
        tickLabel.style.left = `${tickLabelPositions[index]}%`;
        tickLabel.textContent = year;
        tickMarks.appendChild(tickLabel);
      });
    }
  }

  private handleInputChange = (event: Event): void => {
    const value = (event.target as HTMLInputElement).value;
    const years: EraId[] = ['1945', '1965', '1985', '2005', '2025'];
    const year = years[Number(value)];
    if (year) {
      emitEraChanged({ era: year });
      this.updateLoadingIndicator();
    }
  };

  private updateLoadingIndicator(): void {
    this.loadingIndicator.style.display = 'block';
    setTimeout(() => {
      this.loadingIndicator.style.display = 'none';
    }, 1500);
  }
}

export function emitEraChanged(event: { era: EraId }): void {
  const customEvent = new CustomEvent('era-changed', {
    detail: { era: event.era },
    bubbles: true,
    composed: true
  });
  window.dispatchEvent(customEvent);
}

export { TimelineSlider };