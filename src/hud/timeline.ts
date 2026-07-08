/**
 * Timeline UI Component - Slider for 1945-2055 years with smooth transition animations
 */

import type { EraId } from '../eras';
import { ERA_REGISTRY } from '../eras';

export class TimelineUI {
  private element: HTMLElement;
  private buttons: Map<EraId, HTMLButtonElement> = new Map();
  private onEraChangeCallbacks: ((eraId: EraId) => void)[] = [];
  private currentEra: EraId | null = null;

  constructor() {
    this.element = this.createElement();
    this.createButtons();
  }

  private createElement(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'timeline-container';
    container.className = 'timeline-ui';
    return container;
  }

  private createButtons(): void {
    const title = document.createElement('div');
    title.className = 'timeline-title';
    title.textContent = 'Time Period';
    
    const slider = document.createElement('div');
    slider.className = 'timeline-slider';
    
    ERA_REGISTRY.forEach((era, index) => {
      const button = document.createElement('button');
      button.className = 'timeline-year';
      button.textContent = era.year.toString();
      button.dataset.era = era.id;
      button.title = era.label;
      
      // Position as percentage for slider layout
      button.style.left = `${(index / (ERA_REGISTRY.length - 1)) * 100}%`;
      
      button.addEventListener('click', () => this.selectEra(era.id));
      
      slider.appendChild(button);
      this.buttons.set(era.id, button);
    });
    
    this.element.appendChild(title);
    this.element.appendChild(slider);
  }

  private selectEra(eraId: EraId): void {
    if (this.currentEra === eraId) return;
    
    // Update button states
    this.buttons.forEach((btn, id) => {
      btn.classList.toggle('active', id === eraId);
    });
    
    this.currentEra = eraId;
    
    // Trigger callbacks
    this.onEraChangeCallbacks.forEach(cb => cb(eraId));
  }

  /**
   * Register callback for era changes
   */
  onEraChange(callback: (eraId: EraId) => void): void {
    this.onEraChangeCallbacks.push(callback);
  }

  /**
   * Get DOM element
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Animate slider position with era transition
   */
  animateToEra(eraId: EraId): void {
    const button = this.buttons.get(eraId);
    if (button) {
      // Ripple effect
      button.classList.add('transitioning');
      setTimeout(() => button.classList.remove('transitioning'), 1500);
    }
  }

  /**
   * Dispose of event listeners
   */
  dispose(): void {
    this.buttons.forEach(button => {
      button.replaceWith(button.cloneNode(true));
    });
    this.buttons.clear();
  }
}