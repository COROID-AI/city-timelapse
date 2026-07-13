import './styles.css';

import { CityApp } from './app';
import { ERA_REGISTRY, type EraId, type EraSpec } from './eras';

const mount = document.querySelector<HTMLElement>('#app');

if (!mount) {
  throw new Error('Luna could not find its application mount.');
}

const app = new CityApp({
  mount,
  onEraChange: updateEraReadout,
});

mount.prepend(createHud(app.currentEra));
wireTimeline(app);
updateEraReadout(app.currentEra);
window.addEventListener('beforeunload', () => app.dispose(), { once: true });

function createHud(activeEra: EraSpec): HTMLElement {
  const hud = document.createElement('header');
  hud.className = 'hud';
  hud.innerHTML = `
    <div class="brand-lockup">
      <span class="brand-mark" aria-hidden="true">L</span>
      <div>
        <p class="eyebrow">Luna / urban time study</p>
        <h1>City through time</h1>
      </div>
    </div>
    <div class="era-readout" aria-live="polite">
      <span class="era-readout__year">${activeEra.year}</span>
      <span class="era-readout__label">${activeEra.label}</span>
    </div>
  `;
  return hud;
}

function wireTimeline(cityApp: CityApp): void {
  const timeline = document.createElement('nav');
  timeline.className = 'timeline';
  timeline.setAttribute('aria-label', 'Choose a city era');
  timeline.innerHTML = `
    <div class="timeline__line" aria-hidden="true"></div>
    <ol>
      ${ERA_REGISTRY.map(
        (era) => `
          <li>
            <button type="button" class="timeline__era" data-era="${era.id}" aria-label="View ${era.year}: ${era.label}">
              <span class="timeline__dot" aria-hidden="true"></span>
              <span class="timeline__year">${era.year}</span>
              <span class="timeline__name">${era.label}</span>
            </button>
          </li>
        `,
      ).join('')}
    </ol>
    <p class="timeline__hint">Select an era to change the block</p>
  `;
  mount?.append(timeline);

  timeline.querySelectorAll<HTMLButtonElement>('[data-era]').forEach((button) => {
    button.addEventListener('click', () => {
      const era = button.dataset.era as EraId | undefined;
      if (!era) return;
      cityApp.setEra(era);
      updateTimeline(timeline, era);
    });
  });
  updateTimeline(timeline, cityApp.currentEra.id);
}

function updateTimeline(timeline: HTMLElement, activeId: EraId): void {
  timeline.querySelectorAll<HTMLButtonElement>('[data-era]').forEach((button) => {
    const isActive = button.dataset.era === activeId;
    button.classList.toggle('is-active', isActive);
    if (isActive) button.setAttribute('aria-current', 'date');
    else button.removeAttribute('aria-current');
  });
}

function updateEraReadout(era: EraSpec): void {
  const year = document.querySelector<HTMLElement>('.era-readout__year');
  const label = document.querySelector<HTMLElement>('.era-readout__label');
  if (year) year.textContent = String(era.year);
  if (label) label.textContent = era.label;
}
