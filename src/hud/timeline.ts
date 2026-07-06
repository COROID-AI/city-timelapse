// Timeline Slider UI Component
// This component implements a slider for selecting eras in the timeline interface

import { EraId, ERA_IDS, getEraSpec } from '../eras.js';

// Define the timeline slider component
export class TimelineSlider {
  private container: HTMLElement;
  private slider: HTMLInputElement = document.createElement('input');
  private eraLabel!: HTMLElement;
  private eraDescription!: HTMLElement;
  private tickMarksContainer!: HTMLElement;
  private currentEra: EraId = '1945'; // Default era
  private onEraChangeCallback: ((era: EraId) => void) | null = null;

  constructor(containerId: string, onEraChange?: (era: EraId) => void) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    
    this.container = container;
    this.onEraChangeCallback = onEraChange ?? null;
    
    // Initialize UI elements
    this.slider = this.createSlider();
    this.eraLabel = this.createEraLabel();
    this.eraDescription = this.createEraDescription();
    this.tickMarksContainer = this.createTickMarksContainer();
    
    // Initialize the UI
    this.init();
    
    // Set initial era
    this.setEra(this.currentEra);
  }
  
  private createSlider(): HTMLInputElement {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = (ERA_IDS.length - 1).toString();
    slider.step = '1';
    slider.value = '0'; // Start at first era (1945)
    slider.className = 'timeline-slider';
    // ARIA attributes for accessibility
    slider.setAttribute('aria-label', 'Era selector');
    slider.setAttribute('aria-valuemin', '0');
    slider.setAttribute('aria-valuemax', (ERA_IDS.length - 1).toString());
    return slider;
  }
  
  private createEraLabel(): HTMLElement {
    const label = document.createElement('div');
    label.className = 'timeline-era-label';
    return label;
  }
  
  private createEraDescription(): HTMLElement {
    const description = document.createElement('div');
    description.className = 'timeline-era-description';
    return description;
  }
  
  private createTickMarksContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'timeline-tick-marks';
    return container;
  }
  
  private init(): void {
    // Clear container
    this.container.innerHTML = '';
    
    // Create slider container
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'timeline-slider-container';
    
    // Set initial era label and description
    this.updateEraDisplay();
    
    // Create tick marks
    this.createTickMarks();
    
    // Add event listener for slider changes
    this.slider.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const index = parseInt(target.value);
      const era = ERA_IDS[index];
      if (era !== this.currentEra) {
        this.setEra(era);
        // Dispatch custom event
        const event = new CustomEvent('era-changed', {
          detail: { era },
          bubbles: true,
          composed: true
        });
        this.container.dispatchEvent(event);
        // Call callback if provided
        if (this.onEraChangeCallback) {
          this.onEraChangeCallback(era);
        }
      }
    });
    
    // Add event listener for change (to capture keyboard interactions)
    this.slider.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const index = parseInt(target.value);
      const era = ERA_IDS[index];
      if (era !== this.currentEra) {
        this.setEra(era);
        // Dispatch custom event
        const event = new CustomEvent('era-changed', {
          detail: { era },
          bubbles: true,
          composed: true
        });
        this.container.dispatchEvent(event);
        // Call callback if provided
        if (this.onEraChangeCallback) {
          this.onEraChangeCallback(era);
        }
      }
    });
    
    // Assemble the container
    sliderContainer.appendChild(this.eraLabel);
    sliderContainer.appendChild(this.eraDescription);
    sliderContainer.appendChild(this.slider);
    sliderContainer.appendChild(this.tickMarksContainer);
    this.container.appendChild(sliderContainer);
  }
  
  private updateEraDisplay(): void {
    const spec = getEraSpec(this.currentEra);
    this.eraLabel.textContent = spec.label;
    this.eraDescription.textContent = spec.description;
  }
  
  private createTickMarks(): void {
    // Clear existing tick marks
    this.tickMarksContainer.innerHTML = '';
    
    // Create tick marks for each era
    ERA_IDS.forEach((era, index) => {
      const tick = document.createElement('div');
      tick.className = 'timeline-tick';
      tick.style.left = `${(index / (ERA_IDS.length - 1)) * 100}%`;
      
      const label = document.createElement('div');
      label.className = 'timeline-tick-label';
      label.textContent = era;
      
      tick.appendChild(label);
      this.tickMarksContainer.appendChild(tick);
    });
  }
  
  private setEra(era: EraId): void {
    this.currentEra = era;
    this.updateEraDisplay();
    
    // Update slider position
    const index = ERA_IDS.indexOf(era);
    this.slider.value = index.toString();
    this.updateARIAValues();
    
    // Update tick marks to highlight active era
    this.updateActiveTick();
  }
  
  private updateARIAValues(): void {
    const index = ERA_IDS.indexOf(this.currentEra);
    this.slider.setAttribute('aria-valuenow', index.toString());
    this.slider.setAttribute('aria-valuetext', this.currentEra);
  }
  
  private updateActiveTick(): void {
    const ticks = this.tickMarksContainer.querySelectorAll('.timeline-tick');
    ticks.forEach((tick, index) => {
      if (ERA_IDS[index] === this.currentEra) {
        tick.classList.add('active');
      } else {
        tick.classList.remove('active');
      }
    });
  }
  
  // Public method to set era programmatically
  public setEraProgrammatic(era: EraId): void {
    if (era !== this.currentEra) {
      this.setEra(era);
      // Dispatch custom event
      const event = new CustomEvent('era-changed', {
        detail: { era },
        bubbles: true,
        composed: true
      });
      this.container.dispatchEvent(event);
      // Call callback if provided
      if (this.onEraChangeCallback) {
        this.onEraChangeCallback(era);
      }
    }
  }
  
  // Public method to get current era
  public getCurrentEra(): EraId {
    return this.currentEra;
  }
  
  // Public method to destroy the slider and clean up
  public destroy(): void {
    this.slider.removeEventListener('input', () => {});
    this.slider.removeEventListener('change', () => {});
    this.container.innerHTML = '';
  }
}

// CSS for the timeline slider (to be injected into the document)
const style = document.createElement('style');
style.textContent = `
  .timeline-slider-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 8px;
    margin: 1.5rem;
    color: white;
    font-family: 'Courier New', monospace;
    position: relative;
  }
  
  .timeline-era-label {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
    letter-spacing: 1px;
  }
  
  .timeline-era-description {
    font-size: 0.9rem;
    opacity: 0.9;
    margin-bottom: 1.5rem;
    max-width: 300px;
    text-align: center;
    line-height: 1.4;
  }
  
  .timeline-slider {
    width: 300px;
    margin: 0 1rem 1.5rem;
  }
  
  /* Slider styling */
  .timeline-slider::-webkit-slider-runnable-track {
    height: 8px;
    background: linear-gradient(to right, #8b4513, #daa520, #ffd700, #ff8c00, #ff4500);
    border-radius: 4px;
  }
  
  .timeline-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 0 2px rgba(0,0,0,0.5);
    margin-top: -6px;
    transition: background 0.2s, transform 0.2s;
  }
  
  .timeline-slider::-webkit-slider-thumb:hover {
    background: #f0f0f0;
    transform: scale(1.1);
  }
  
  .timeline-slider::-moz-range-track {
    height: 8px;
    background: linear-gradient(to right, #8b4513, #daa520, #ffd700, #ff8c00, #ff4500);
    border-radius: 4px;
    border: none;
  }
  
  .timeline-slider::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 0 2px rgba(0,0,0,0.5);
  }
  
  .timeline-slider:focus::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px rgba(255,255,255,0.7);
  }
  
  .timeline-slider:focus::-moz-range-thumb {
    box-shadow: 0 0 0 3px rgba(255,255,255,0.7);
  }
  
  /* Tick marks */
  .timeline-tick-marks {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 40px;
    display: flex;
    justify-content: space-between;
    padding: 0 10px;
    box-sizing: border-box;
    pointer-events: none;
  }
  
  .timeline-tick {
    position: relative;
    width: 2px;
    height: 10px;
    background-color: #ccc;
  }
  
  .timeline-tick.active {
    background-color: #fff;
    height: 14px;
  }
  
  .timeline-tick-label {
    position: absolute;
    top: 18px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.75rem;
    color: #ccc;
    white-space: nowrap;
    pointer-events: none;
  }
  
  .timeline-tick-label.active {
    color: #fff;
    font-weight: bold;
  }
`;

// Append the style to the document head
document.head.appendChild(style);