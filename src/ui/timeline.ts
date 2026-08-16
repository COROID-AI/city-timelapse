// ─── Timeline Slider ────────────────────────────────────────────────
// Top-of-screen timeline with clickable stops, drag, and keyboard
// navigation. Emits typed era-change events; does NOT import scene
// modules.

import { ERA_REGISTRY, type EraId } from '../eras.js';
import './ui.css';

// ── Events ──────────────────────────────────────────────────────────

export interface EraChangeDetail {
  eraId: EraId;
  year: number;
  label: string;
  description: string;
}

export class EraChangeEvent extends CustomEvent<EraChangeDetail> {
  constructor(detail: EraChangeDetail) {
    super('erachange', { bubbles: true, detail });
  }
}

// ── Constants ───────────────────────────────────────────────────────

const STOP_POSITIONS = ERA_REGISTRY.map((_, i) => i / (ERA_REGISTRY.length - 1));

// ── DOM Creation ────────────────────────────────────────────────────

let container: HTMLElement | null = null;

function buildDOM(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ui-layer';
  el.setAttribute('role', 'application');
  el.setAttribute('aria-label', 'City Era Timelapse Controls');

  // ── Timeline bar ────────────────────────────────────────────────
  const timeline = document.createElement('div');
  timeline.className = 'timeline';
  timeline.setAttribute('role', 'region');
  timeline.setAttribute('aria-label', 'Era Timeline');

  const bar = document.createElement('div');
  bar.className = 'timeline-bar';

  const trackWrapper = document.createElement('div');
  trackWrapper.className = 'timeline-track-wrapper';

  const track = document.createElement('div');
  track.className = 'timeline-track';
  track.setAttribute('role', 'presentation');

  const progress = document.createElement('div');
  progress.className = 'timeline-progress';
  progress.id = 'timeline-progress';
  track.appendChild(progress);

  const stopsContainer = document.createElement('div');
  stopsContainer.className = 'timeline-stops';

  const stops: HTMLDivElement[] = [];

  ERA_REGISTRY.forEach((era, index) => {
    const stop = document.createElement('div');
    stop.className = 'timeline-stop' + (index === 0 ? ' active' : '');
    stop.setAttribute('role', 'button');
    stop.setAttribute('tabindex', '0');
    stop.setAttribute('aria-label', `${era.label} — ${era.year}`);
    stop.setAttribute('data-era-id', era.id);
    stop.dataset.index = String(index);
    stop.id = `era-${era.id}`;
    stop.dataset.testId = era.id;

    const dot = document.createElement('span');
    dot.className = 'timeline-stop-dot';

    const yearLabel = document.createElement('span');
    yearLabel.className = 'timeline-stop-year';
    yearLabel.textContent = String(era.year);

    stop.appendChild(dot);
    stop.appendChild(yearLabel);
    stopsContainer.appendChild(stop);
    stops.push(stop);

    // Click handler
    stop.addEventListener('click', () => handleStopClick(index));
    // Keyboard Enter/Space
    stop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleStopClick(index);
      }
    });
  });

  trackWrapper.appendChild(track);
  trackWrapper.appendChild(stopsContainer);

  // Thumb (draggable handle)
  const thumb = document.createElement('div');
  thumb.className = 'timeline-thumb';
  thumb.id = 'timeline-thumb';
  thumb.setAttribute('role', 'slider');
  thumb.setAttribute('tabindex', '0');
  thumb.setAttribute('aria-valuemin', '0');
  thumb.setAttribute('aria-valuemax', String(STOP_POSITIONS.length - 1));
  thumb.setAttribute('aria-valuenow', '0');
  thumb.setAttribute('aria-valuetext', ERA_REGISTRY[0].label);
  thumb.setAttribute('aria-label', 'Timeline position');
  trackWrapper.appendChild(thumb);

  bar.appendChild(trackWrapper);
  timeline.appendChild(bar);

  // Era label under timeline
  const labelEl = document.createElement('div');
  labelEl.className = 'timeline-era-label';
  labelEl.id = 'timeline-era-label';

  const nameEl = document.createElement('div');
  nameEl.className = 'timeline-era-name';
  nameEl.id = 'timeline-era-name';
  nameEl.textContent = ERA_REGISTRY[0].label;

  const descEl = document.createElement('div');
  descEl.className = 'timeline-era-desc';
  descEl.id = 'timeline-era-desc';
  descEl.textContent = ERA_REGISTRY[0].description;

  labelEl.appendChild(nameEl);
  labelEl.appendChild(descEl);
  timeline.appendChild(labelEl);

  el.appendChild(timeline);

  return el;
}

// ── Interaction Handlers ────────────────────────────────────────────

let currentIndex = 0;
let isDragging = false;

function emitEraChange(index: number): void {
  const era = ERA_REGISTRY[index];
  const detail: EraChangeDetail = {
    eraId: era.id,
    year: era.year,
    label: era.label,
    description: era.description,
  };
  container?.dispatchEvent(new EraChangeEvent(detail));
}

function setActiveIndex(index: number): void {
  currentIndex = Math.max(0, Math.min(index, STOP_POSITIONS.length - 1));

  const pos = STOP_POSITIONS[currentIndex];
  const pct = pos * 100;

  // Update progress bar
  const progress = container?.querySelector('#timeline-progress') as HTMLElement | null;
  if (progress) progress.style.width = `${pct}%`;

  // Update thumb position and ARIA
  const thumbEl = container?.querySelector('#timeline-thumb') as HTMLElement | null;
  if (thumbEl) {
    thumbEl.style.left = `calc(${pct}% + 16px)`; // +16px for track padding
    thumbEl.setAttribute('aria-valuenow', String(currentIndex));
    thumbEl.setAttribute('aria-valuetext', ERA_REGISTRY[currentIndex].label);
  }

  // Update era label
  const era = ERA_REGISTRY[currentIndex];
  const nameEl = container?.querySelector('#timeline-era-name') as HTMLElement | null;
  const descEl = container?.querySelector('#timeline-era-desc') as HTMLElement | null;
  if (nameEl) nameEl.textContent = era.label;
  if (descEl) descEl.textContent = era.description;

  // Set data-era attribute for CSS theming
  container?.closest('.ui-layer')?.setAttribute('data-era', era.id);

  emitEraChange(currentIndex);
}

function handleStopClick(index: number): void {
  setActiveIndex(index);
}

// ── Drag Support ────────────────────────────────────────────────────

function getTrackRect(): DOMRect | null {
  const track = container?.querySelector('.timeline-track') as HTMLElement | null;
  return track?.getBoundingClientRect() ?? null;
}

function positionFromPointer(clientX: number): void {
  const rect = getTrackRect();
  if (!rect) return;

  const trackWidth = rect.width - 32; // subtract left/right padding
  let ratio = (clientX - rect.left - 16) / trackWidth;
  ratio = Math.max(0, Math.min(1, ratio));

  // Snap to nearest stop
  const closestIndex = Math.round(ratio * (STOP_POSITIONS.length - 1));
  setActiveIndex(closestIndex);
}

function initDrag(): void {
  const thumb = container?.querySelector('#timeline-thumb') as HTMLElement | null;
  if (!thumb) return;

  // Store reference for closure access (TypeScript narrows via early return above)
  const t = thumb;

  function onStart(e: PointerEvent): void {
    e.preventDefault();
    isDragging = true;
    t.setPointerCapture(e.pointerId);
    t.style.cursor = 'grabbing';
  }

  function onMove(e: PointerEvent): void {
    if (!isDragging) return;
    positionFromPointer(e.clientX);
  }

  function onEnd(): void {
    if (!isDragging) return;
    isDragging = false;
    t.style.cursor = 'grab';
  }

  t.addEventListener('pointerdown', onStart);
  t.addEventListener('pointermove', onMove);
  t.addEventListener('pointerup', onEnd);
  thumb.addEventListener('pointercancel', onEnd);
}

// ── Keyboard Navigation ─────────────────────────────────────────────

function initKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    // Only respond when focused inside our layer or global arrow keys
    const target = e.target as HTMLElement | null;
    const isInTimeline = target?.closest('.timeline') !== null;
    if (!isInTimeline && !target?.closest('.ui-layer')) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(currentIndex + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(currentIndex - 1);
    }
  });
}

// ── Public API ──────────────────────────────────────────────────────

/** Mount the timeline into the given container (or body). */
export function mountTimeline(parent?: HTMLElement): HTMLElement {
  container = buildDOM();
  (parent ?? document.body).appendChild(container);

  // Set initial position
  requestAnimationFrame(() => {
    setActiveIndex(0);
  });

  initDrag();
  initKeyboard();

  // Set initial era attribute
  container.setAttribute('data-era', '1945');

  return container;
}

/** Return current era index (0-based). */
export function getCurrentEraIndex(): number {
  return currentIndex;
}

/** Jump to a specific era index. */
export function setEraByIndex(index: number): void {
  setActiveIndex(index);
}

/** Set by era id string. */
export function setEraById(id: EraId): void {
  const idx = ERA_REGISTRY.findIndex((e) => e.id === id);
  if (idx >= 0) setActiveIndex(idx);
}

/** Remove the timeline from the DOM. */
export function unmountTimeline(): void {
  container?.remove();
  container = null;
  currentIndex = 0;
}
