// Shows current year + era description; fades text on era change.
export class EraInfoPanel {
  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'era-info';
    this.element.innerHTML = `
      <div class="ei-year"></div>
      <div class="ei-name"></div>
      <div class="ei-desc"></div>
    `;
    this.yearEl = this.element.querySelector('.ei-year');
    this.nameEl = this.element.querySelector('.ei-name');
    this.descEl = this.element.querySelector('.ei-desc');
  }

  show(era) {
    this.element.style.opacity = '0';
    setTimeout(() => {
      this.yearEl.textContent = era.year;
      this.nameEl.textContent = era.name;
      this.descEl.textContent = era.description;
      this.element.style.opacity = '1';
    }, 180);
  }
}
