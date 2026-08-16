/**
 * src/ui/timeline.ts
 *
 * Top-center timeline slider with 5 labeled stops (1945, 1965, 1985, 2005, 2025).
 * Supports click/drag selection, keyboard arrow navigation, ARIA slider semantics,
 * and hover/active/focus visual states. Includes a play/scrub mode that sweeps
 * chronologically through all eras while the user drags between stops.
 */

import './timeline.css';
import { ERA_REGISTRY, type EraId } from '../eras.js';

// ── Public API ──────────────────────────────────────────

export interface TimelineConfig {
  /** Callback fired when the selected era changes (includes intermediate scrub values). */
  onEraChange?: (eraId: EraId, year: number) => void;
  /** Whether to enable play/scrub continuous sweep mode (default false). */
  scrubMode?: boolean;
}

export interface TimelineState {
  /** Currently selected era ID. */
  eraId: EraId;
  /** Current year (for scrub mode, may be interpolated). */
  year: number;
  /** Index into ERA_REGISTRY (0–4). */
  index: number;
  /** Whether the scrubber is actively being dragged. */
  dragging: boolean;
  /** Whether play/scrub mode is active. */
  scrubMode: boolean;
}

type TimelineCallback = (eraId: EraId, year: number) => void;

// ── Constants ───────────────────────────────────────────

const STOP_COUNT = ERA_REGISTRY.length; // 5

// ── DOM element references ──────────────────────────────

let container: HTMLDivElement | null = null;
let railEl: HTMLElement | null = null;
let fillEl: HTMLElement | null = null;
let scrubberEl: HTMLElement | null = null;
let stopsEls: HTMLElement[] = [];
let labelEls: HTMLElement[] = [];
let titleEl: HTMLElement | null = null;
let descEl: HTMLElement | null = null;
let readoutEl: HTMLElement | null = null;
let playBtnEl: HTMLElement | null = null;

let currentEraIndex = 0;
let scrubMode = false;
let onEraChangeCb: TimelineCallback | null = null;

// Drag state
let dragActive = false;
let lastEraEmitted: string | null = null;

// Play mode animation
let playRAF: number | null = null;
let playStartTime = 0;
const PLAY_DURATION_MS = 4000; // time per era during play sweep

// ── Helpers ─────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function indexToPercent(i: number): number {
  if (STOP_COUNT <= 1) return 0;
  return (i / (STOP_COUNT - 1)) * 100;
}

function percentToIndex(pct: number): number {
  if (STOP_COUNT <= 1) return 0;
  const raw = (pct / 100) * (STOP_COUNT - 1);
  return clamp(Math.round(raw), 0, STOP_COUNT - 1);
}

function setEra(index: number, emit = true): void {
  const clamped = clamp(index, 0, STOP_COUNT - 1);
  currentEraIndex = clamped;
  const era = ERA_REGISTRY[clamped];

  // Update rail fill & scrubber position
  const pct = indexToPercent(clamped);
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (scrubberEl) scrubberEl.style.left = `${pct}%`;

  // Update stop visuals
  stopsEls.forEach((el, i) => {
    el.classList.toggle('active', i === clamped);
    el.classList.toggle('past', i < clamped);
    el.setAttribute('aria-selected', String(i === clamped));
  });

  // Update label visuals
  labelEls.forEach((el, i) => {
    el.classList.toggle('active', i === clamped);
  });

  // Update caption
  if (titleEl) titleEl.textContent = era.label;
  if (descEl) descEl.textContent = era.description;

  // Update readout
  if (readoutEl) {
    readoutEl.textContent = String(era.year);
    readoutEl.classList.add('active');
    setTimeout(() => readoutEl?.classList.remove('active'), 600);
  }

  // Emit callback
  if (emit && onEraChangeCb) {
    const key = era.id;
    if (key !== lastEraEmitted) {
      lastEraEmitted = key;
      onEraChangeCb(era.id, era.year);
    }
  }
}

function updateReadoutForScrub(pct: number): void {
  if (!readoutEl) return;
  if (STOP_COUNT <= 1) {
    readoutEl.textContent = String(ERA_REGISTRY[0].year);
    return;
  }
  // Interpolate year across the full range
  const firstYear = ERA_REGISTRY[0].year;
  const lastYear = ERA_REGISTRY[STOP_COUNT - 1].year;
  const year = Math.round(firstYear + ((lastYear - firstYear) * pct) / 100);
  readoutEl.textContent = String(year);
}

// ── Play / scrub continuous mode ────────────────────────

function startPlaySweep(): void {
  stopPlaySweep();
  playStartTime = performance.now();
  playRAF = requestAnimationFrame(_playStep);
}

function _playStep(now: number): void {
  const elapsed = now - playStartTime;
  const totalDuration = PLAY_DURATION_MS * (STOP_COUNT - 1);
  const progress = clamp(elapsed / totalDuration, 0, 1);
  const pct = progress * 100;

  // Emit era at each boundary crossing
  const idx = percentToIndex(pct);
  setEra(idx, true);

  // Update readout for continuous scrub feel
  updateReadoutForScrub(pct);

  if (progress < 1 && scrubMode) {
    playRAF = requestAnimationFrame(_playStep);
  } else {
    playRAF = null;
  }
}

function stopPlaySweep(): void {
  if (playRAF !== null) {
    cancelAnimationFrame(playRAF);
    playRAF = null;
  }
}

function togglePlayMode(): void {
  scrubMode = !scrubMode;
  if (scrubMode) {
    playBtnEl?.classList.add('playing');
    if (playBtnEl) playBtnEl.textContent = '⏸ Scrub';
    startPlaySweep();
  } else {
    playBtnEl?.classList.remove('playing');
    if (playBtnEl) playBtnEl.textContent = '▶ Play';
    stopPlaySweep();
  }
}

// ── Pointer / drag handling ─────────────────────────────

function handleRailPointerDown(e: PointerEvent): void {
  if (!railEl || !scrubberEl) return;
  e.preventDefault();
  dragActive = true;
  scrubberEl.classList.add('dragging');
  railEl.setPointerCapture(e.pointerId);

  railEl.addEventListener('pointermove', handleRailPointerMove);
  railEl.addEventListener('pointerup', handleRailPointerUp);
  railEl.addEventListener('pointercancel', handleRailPointerUp);
}

function handleRailPointerMove(e: PointerEvent): void {
  if (!railEl || !scrubberEl) return;
  const rect = railEl.getBoundingClientRect();
  const pct = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
  const idx = percentToIndex(pct);

  scrubberEl.style.left = `${pct}%`;
  if (fillEl) fillEl.style.width = `${pct}%`;

  // Update readout continuously during drag
  updateReadoutForScrub(pct);

  // Update stop visuals without emitting callback (no flicker)
  stopsEls.forEach((el, i) => {
    el.classList.toggle('active', i === idx);
    el.classList.toggle('past', i < idx);
  });
  labelEls.forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}

function handleRailPointerUp(): void {
  if (!scrubberEl) return;
  dragActive = false;
  scrubberEl.classList.remove('dragging');

  // Snap to nearest stop and emit final era
  const pct = parseFloat(scrubberEl.style.left) || 0;
  const idx = percentToIndex(pct);
  setEra(idx, true);

  lastEraEmitted = ERA_REGISTRY[idx].id;

  // Clean up listeners
  if (railEl) {
    railEl.removeEventListener('pointermove', handleRailPointerMove);
    railEl.removeEventListener('pointerup', handleRailPointerUp);
    railEl.removeEventListener('pointercancel', handleRailPointerUp);
  }
}

// ── Keyboard navigation ─────────────────────────────────

function handleKeydown(e: KeyboardEvent): void {
  if (!container) return;

  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      setEra(currentEraIndex + 1, true);
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      setEra(currentEraIndex - 1, true);
      break;
    case 'Home':
      e.preventDefault();
      setEra(0, true);
      break;
    case 'End':
      e.preventDefault();
      setEra(STOP_COUNT - 1, true);
      break;
  }
}

// ── Build DOM ───────────────────────────────────────────

function buildUI(): HTMLDivElement {
  container = document.createElement('div');
  container.className = 'timeline-container';
  container.setAttribute('role', 'application');
  container.setAttribute('aria-label', 'Timeline era selector');
  container.tabIndex = 0;
  container.addEventListener('keydown', handleKeydown);

  // ── Rail wrapper ──────────────────────────────────────
  const railWrapper = document.createElement('div');
  railWrapper.className = 'timeline-rail-wrapper';

  const rail = document.createElement('div');
  rail.className = 'timeline-rail';
  rail.setAttribute('role', 'slider');
  rail.setAttribute('aria-label', 'Select era');
  rail.setAttribute('aria-valuemin', '0');
  rail.setAttribute('aria-valuemax', String(STOP_COUNT - 1));
  rail.setAttribute('aria-valuenow', '0');
  rail.setAttribute('aria-orientation', 'horizontal');
  rail.setAttribute('tabindex', '0');

  const fill = document.createElement('div');
  fill.className = 'timeline-fill';

  const scrubber = document.createElement('div');
  scrubber.className = 'timeline-scrubber';
  scrubber.setAttribute('aria-hidden', 'true');

  rail.appendChild(fill);
  rail.appendChild(scrubber);

  // Stop markers
  const stopsContainer = document.createElement('div');
  stopsContainer.className = 'timeline-stops';
  ERA_REGISTRY.forEach((era, i) => {
    const stop = document.createElement('div');
    stop.className = 'timeline-stop' + (i === 0 ? ' active' : '');
    stop.setAttribute('role', 'radio');
    stop.setAttribute('aria-label', `${era.year} – ${era.label}`);
    stop.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
    stop.setAttribute('tabindex', i === 0 ? '0' : '-1');
    stop.style.left = `${indexToPercent(i)}%`;
    stop.dataset.index = String(i);

    stop.addEventListener('click', () => {
      setEra(i, true);
      lastEraEmitted = ERA_REGISTRY[i].id;
    });

    stopsContainer.appendChild(stop);
  });
  rail.appendChild(stopsContainer);

  railWrapper.appendChild(rail);

  // Year labels
  const yearLabels = document.createElement('div');
  yearLabels.className = 'timeline-year-labels';
  ERA_REGISTRY.forEach((era, i) => {
    const label = document.createElement('div');
    label.className = 'timeline-year-label' + (i === 0 ? ' active' : '');
    label.textContent = String(era.year);
    label.setAttribute('tabindex', '0');
    label.setAttribute('role', 'button');
    label.setAttribute('aria-label', `Go to ${era.year}`);
    label.addEventListener('click', () => {
      setEra(i, true);
      lastEraEmitted = era.id;
    });
    yearLabels.appendChild(label);
  });
  railWrapper.appendChild(yearLabels);

  container.appendChild(railWrapper);

  // Caption
  const caption = document.createElement('div');
  caption.className = 'timeline-caption';

  const title = document.createElement('div');
  title.className = 'timeline-era-title';
  title.textContent = ERA_REGISTRY[0].label;

  const desc = document.createElement('div');
  desc.className = 'timeline-era-description';
  desc.textContent = ERA_REGISTRY[0].description;

  caption.appendChild(title);
  caption.appendChild(desc);
  container.appendChild(caption);

  container.appendChild(railWrapper);
  // Re-append railWrapper so it's above caption in DOM order
  container.removeChild(railWrapper);
  container.insertBefore(railWrapper, caption);

  // Readout
  readoutEl = document.createElement('div');
  readoutEl.className = 'timeline-readout active';
  readoutEl.textContent = String(ERA_REGISTRY[0].year);
  container.appendChild(readoutEl);

  // Play button
  playBtnEl = document.createElement('button');
  playBtnEl.className = 'timeline-play-btn';
  playBtnEl.textContent = '▶ Play';
  playBtnEl.setAttribute('aria-label', 'Toggle play/scrub mode');
  playBtnEl.addEventListener('click', togglePlayMode);
  container.appendChild(playBtnEl);

  // Wire up refs
  railEl = rail;
  fillEl = fill;
  scrubberEl = scrubber;
  stopsEls = Array.from(stopsContainer.children) as HTMLElement[];
  labelEls = Array.from(yearLabels.children) as HTMLElement[];
  titleEl = title;
  descEl = desc;

  // Set initial position
  railEl.setAttribute('aria-valuenow', '0');
  fillEl!.style.width = '0%';
  scrubberEl!.style.left = '0%';

  // Attach pointer events to rail
  rail.addEventListener('pointerdown', handleRailPointerDown);

  return container;
}

// ── Public API ──────────────────────────────────────────

/**
 * Mount the timeline UI into the HUD container.
 */
export function mountTimeline(config: TimelineConfig = {}): HTMLDivElement {
  onEraChangeCb = config.onEraChange ?? null;
  scrubMode = !!config.scrubMode;

  const hud = document.getElementById('hud');
  if (!hud) {
    console.error('[Timeline] HUD container not found');
    const fallback = buildUI();
    document.body.appendChild(fallback);
    return fallback;
  }

  const ui = buildUI();
  hud.appendChild(ui);

  // Initial render
  setEra(0, false);

  return ui;
}

/**
 * Programmatically select an era by ID.
 */
export function selectEra(eraId: EraId): void {
  const idx = ERA_REGISTRY.findIndex((e) => e.id === eraId);
  if (idx === -1) {
    console.warn(`[Timeline] Unknown era ID: ${eraId}`);
    return;
  }
  setEra(idx, true);
  lastEraEmitted = eraId;
}

/**
 * Get the current timeline state.
 */
export function getTimelineState(): TimelineState {
  const era = ERA_REGISTRY[currentEraIndex];
  return {
    eraId: era.id,
    year: era.year,
    index: currentEraIndex,
    dragging: dragActive,
    scrubMode,
  };
}

/**
 * Enable or disable scrub/play mode.
 */
export function setScrubMode(enabled: boolean): void {
  scrubMode = enabled;
  if (enabled && playBtnEl) {
    playBtnEl.classList.add('playing');
    playBtnEl.textContent = '⏸ Scrub';
    startPlaySweep();
  } else if (playBtnEl) {
    playBtnEl.classList.remove('playing');
    playBtnEl.textContent = '▶ Play';
    stopPlaySweep();
  }
}

/**
 * Unmount and clean up the timeline UI.
 */
export function unmountTimeline(): void {
  stopPlaySweep();
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
  railEl = null;
  fillEl = null;
  scrubberEl = null;
  stopsEls = [];
  labelEls = [];
  titleEl = null;
  descEl = null;
  readoutEl = null;
  playBtnEl = null;
  onEraChangeCb = null;
  currentEraIndex = 0;
  lastEraEmitted = null;
}
