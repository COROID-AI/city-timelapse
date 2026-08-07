import './styles.css';

import { CityApp } from './app';
import { SfxMixer } from './audio/mixer';
import { ERA_REGISTRY, type EraId, type EraSpec } from './eras';

const mount = document.querySelector<HTMLElement>('#app');

if (!mount) {
  throw new Error('Luna could not find its application mount.');
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mixer = new SfxMixer({ initialEra: ERA_REGISTRY[0].id, reducedMotion, crossfadeSeconds: 1.6 });
let timeline: HTMLElement | undefined;

const app = new CityApp({
  mount,
  onEraChange: (era, transition) => {
    updateEraReadout(era);
    if (mixer.currentEra !== transition.to) mixer.setEra(transition.to);
    if (timeline) updateTimeline(timeline, transition.to, transition.isTransitioning);
  },
});

mount.prepend(createHud(app.currentEra));
timeline = createTimeline(app);
mount.append(timeline);
mount.append(createControlDock(app, mixer));
mount.setAttribute('data-quality', app.quality);
updateEraReadout(app.currentEra);
updateTimeline(timeline, app.currentEra.id);
window.addEventListener('beforeunload', () => {
  mixer.dispose();
  app.dispose();
}, { once: true });

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

function createTimeline(cityApp: CityApp): HTMLElement {
  const timeline = document.createElement('nav');
  timeline.className = 'timeline';
  timeline.setAttribute('aria-label', 'Choose a city era');
  timeline.innerHTML = `
    <div class="timeline__heading">
      <span class="eyebrow">Timeline / select a year</span>
      <span class="timeline__state" aria-live="polite">Scene ready</span>
    </div>
    <input class="timeline__range" type="range" min="0" max="${ERA_REGISTRY.length - 1}" step="1" value="0" aria-label="Era timeline" data-testid="era-range" />
    <div class="timeline__line" aria-hidden="true"></div>
    <ol>
      ${ERA_REGISTRY.map(
        (era) => `
          <li>
            <button type="button" class="timeline__era" data-era="${era.id}" data-testid="era-${era.id}" aria-label="View ${era.year}: ${era.label}">
              <span class="timeline__dot" aria-hidden="true"></span>
              <span class="timeline__year">${era.year}</span>
              <span class="timeline__name">${era.label}</span>
            </button>
          </li>
        `,
      ).join('')}
    </ol>
    <p class="timeline__hint">Click a year, use arrow keys, or scrub the line to transform the block</p>
  `;

  const range = timeline.querySelector<HTMLInputElement>('.timeline__range');
  range?.addEventListener('input', () => {
    const era = ERA_REGISTRY[Number(range.value)]?.id;
    if (era) selectEra(cityApp, timeline, era);
  });
  timeline.querySelectorAll<HTMLButtonElement>('[data-era]').forEach((button) => {
    button.addEventListener('click', () => {
      const era = button.dataset.era as EraId | undefined;
      if (era) selectEra(cityApp, timeline, era);
    });
  });
  return timeline;
}

function selectEra(cityApp: CityApp, timeline: HTMLElement, era: EraId): void {
  cityApp.setEra(era);
  if (cityApp.currentEra.id === era) updateTimeline(timeline, era, cityApp.isTransitioning);
}

function updateTimeline(timeline: HTMLElement, activeId: EraId, isTransitioning = false): void {
  const activeIndex = ERA_REGISTRY.findIndex((era) => era.id === activeId);
  const activeEra = ERA_REGISTRY[activeIndex];
  const range = timeline.querySelector<HTMLInputElement>('.timeline__range');
  if (range && activeIndex >= 0) {
    range.value = String(activeIndex);
    range.setAttribute('aria-valuetext', `${activeEra.year}, ${activeEra.label}`);
  }
  const state = timeline.querySelector<HTMLElement>('.timeline__state');
  if (state && activeEra) {
    state.textContent = `${activeEra.year} / ${isTransitioning ? 'transforming' : 'settled'}`;
    timeline.setAttribute('aria-busy', String(isTransitioning));
  }
  timeline.querySelectorAll<HTMLButtonElement>('[data-era]').forEach((button) => {
    const isActive = button.dataset.era === activeId;
    button.classList.toggle('is-active', isActive);
    if (isActive) {
      button.setAttribute('aria-current', 'date');
      button.setAttribute('aria-pressed', 'true');
    } else {
      button.removeAttribute('aria-current');
      button.setAttribute('aria-pressed', 'false');
    }
  });
}

function createControlDock(cityApp: CityApp, audio: SfxMixer): HTMLElement {
  const dock = document.createElement('section');
  dock.className = 'control-dock';
  dock.setAttribute('aria-label', 'Scene controls');
  dock.innerHTML = `
    <div class="control-dock__buttons">
      <button type="button" class="control-button" data-control="audio" data-testid="control-audio" aria-pressed="false">Sound off</button>
      <button type="button" class="control-button" data-control="pause" data-testid="control-pause" aria-pressed="false">Pause scene</button>
      <button type="button" class="control-button" data-control="reset" data-testid="control-reset">Reset view</button>
      <button type="button" class="control-button" data-control="help" data-testid="control-help" aria-expanded="false" aria-controls="scene-help">Controls</button>
    </div>
    <aside id="scene-help" class="scene-help" hidden>
      <strong>Explore the block</strong>
      <p>Drag to orbit · wheel or pinch to zoom · WASD or arrow keys to move · Q/E to change height · Home resets view.</p>
      <p>Use the timeline above to stage a time change. Sound starts only after you choose Sound on.</p>
    </aside>
  `;
  const audioButton = dock.querySelector<HTMLButtonElement>('[data-control="audio"]');
  audioButton?.addEventListener('click', async () => {
    const enabled = await audio.setEnabled(!audio.isEnabled);
    audioButton.textContent = enabled && audio.isEnabled ? 'Sound on' : 'Sound unavailable';
    audioButton.setAttribute('aria-pressed', String(audio.isEnabled));
  });
  const pauseButton = dock.querySelector<HTMLButtonElement>('[data-control="pause"]');
  pauseButton?.addEventListener('click', () => {
    const paused = cityApp.togglePaused();
    pauseButton.textContent = paused ? 'Resume scene' : 'Pause scene';
    pauseButton.setAttribute('aria-pressed', String(paused));
  });
  dock.querySelector<HTMLButtonElement>('[data-control="reset"]')?.addEventListener('click', () => cityApp.resetView());
  const helpButton = dock.querySelector<HTMLButtonElement>('[data-control="help"]');
  const help = dock.querySelector<HTMLElement>('#scene-help');
  helpButton?.addEventListener('click', () => {
    const open = help?.hidden ?? true;
    if (help) help.hidden = !open;
    helpButton.setAttribute('aria-expanded', String(open));
  });
  return dock;
}

function updateEraReadout(era: EraSpec): void {
  const year = document.querySelector<HTMLElement>('.era-readout__year');
  const label = document.querySelector<HTMLElement>('.era-readout__label');
  if (year) year.textContent = String(era.year);
  if (label) label.textContent = era.label;
  mount?.setAttribute('data-era', era.id);
  mount?.setAttribute('data-quality', app.quality);
}
