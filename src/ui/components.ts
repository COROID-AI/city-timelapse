/**
 * UI Component Library - Buttons, sliders, era indicators, and info panels using vanilla DOM/CSS
 */

export class UIComponent {
  protected element: HTMLElement;

  constructor(tag: string, className?: string) {
    this.element = document.createElement(tag);
    if (className) {
      this.element.className = className;
    }
  }

  getElement(): HTMLElement {
    return this.element;
  }
}

export class Button extends UIComponent {
  constructor(label: string, onClick: () => void) {
    super('button', 'ui-button');
    this.element.textContent = label;
    this.element.addEventListener('click', onClick);
  }
}

export class Slider extends UIComponent {
  private input: HTMLInputElement;

  constructor(min: number, max: number, value: number, onChange: (val: number) => void) {
    super('div', 'ui-slider');
    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.min = min.toString();
    this.input.max = max.toString();
    this.input.value = value.toString();
    this.input.addEventListener('input', () => onChange(parseFloat(this.input.value)));
    this.element.appendChild(this.input);
  }

  getValue(): number {
    return parseFloat(this.input.value);
  }
}

export class EraIndicator extends UIComponent {
  constructor() {
    super('div', 'era-indicator');
    this.element.textContent = 'Current Era: ---';
  }

  setEra(eraId: string): void {
    this.element.textContent = `Current Era: ${eraId}`;
  }
}