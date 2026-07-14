import { ERA_KEYS } from '../core/constants.js';

// Builds the top timeline with 6 year markers and dispatches era changes.
export class TimelineSlider {
  constructor(onSelect) {
    this.onSelect = onSelect;
    this.activeIndex = 0;
    this.element = this._build();
    this.markerEls = [...this.element.querySelectorAll('.marker')];
    this.fillEl = this.element.querySelector('.timeline-fill');
    this.currentYearEl = this.element.querySelector('.current-year');
    this._updateActive();
  }

  _build() {
    const wrap = document.createElement('div');
    wrap.className = 'timeline-wrap';
    wrap.innerHTML = `
      <div class="timeline-title">
        <span class="label">City Era Timeline</span>
        <span class="current-year">1945</span>
      </div>
      <div class="timeline-track">
        <div class="timeline-bar"><div class="timeline-fill"></div></div>
        <div class="timeline-markers">
          ${ERA_KEYS.map((y, i) => `
            <button class="marker" data-index="${i}" aria-label="Year ${y}">
              <span class="dot"></span>
              <span class="year">${y}</span>
              <span class="key">${i + 1}</span>
            </button>`).join('')}
        </div>
      </div>
    `;
    wrap.addEventListener('click', (e) => {
      const m = e.target.closest('.marker');
      if (!m) return;
      this.select(parseInt(m.dataset.index, 10));
    });
    return wrap;
  }

  select(index, { silent = false } = {}) {
    if (index < 0 || index >= ERA_KEYS.length) return;
    this.activeIndex = index;
    this._updateActive();
    if (!silent && this.onSelect) this.onSelect(ERA_KEYS[index], index);
  }

  _updateActive() {
    this.markerEls.forEach((m, i) => m.classList.toggle('active', i === this.activeIndex));
    this.fillEl.style.width = `${(this.activeIndex / (ERA_KEYS.length - 1)) * 100}%`;
    this.currentYearEl.textContent = ERA_KEYS[this.activeIndex];
  }

  get activeKey() {
    return ERA_KEYS[this.activeIndex];
  }
}
