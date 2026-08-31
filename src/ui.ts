/**
 * HUD / UI: top timeline slider with era chips, era description, and control
 * toggles (mute, quality). Keyboard operate-able; exposes era change + boot.
 *
 * Keyboard model: when focus is inside the HUD (e.g. on the range slider or
 * chips), native control behavior wins so the slider's own arrow/home/end
 * keys work. When focus is anywhere else (body/canvas), the global handler
 * lets ← / → / Home / End travel the timeline.
 */

import { ERA_REGISTRY, getEraSpec, type EraId } from './eras';

export interface UiCallbacks {
  onEraChange(era: EraId): void;
  onToggleMute(): void;
  onToggleQuality(): void;
}

export interface CityUi {
  readonly root: HTMLElement;
  setEra(era: EraId): void;
  setMuted(muted: boolean): void;
  setLowQuality(low: boolean): void;
  dispose(): void;
}

/** Boot overlay controls: include handlers for the "Enter" gesture. */
export interface BootControls {
  show(): void;
  hide(): void;
  onEnter(cb: () => void): void;
}

export function createBootControls(): BootControls {
  const boot = document.getElementById('boot');
  const status = document.getElementById('boot-status');
  const enter = document.getElementById('boot-enter');
  if (!boot || !status || !enter) {
    throw new Error('Boot overlay markup missing');
  }
  const ctrl: BootControls = {
    show(): void {
      boot.classList.remove('hidden');
    },
    hide(): void {
      boot.classList.add('hidden');
    },
    onEnter(cb: () => void): void {
      enter.addEventListener('click', () => {
        cb();
        ctrl.hide();
      });
    },
  };
  return ctrl;
}

export function createCityUi(callbacks: UiCallbacks): CityUi {
  const root = document.createElement('div');
  root.id = 'hud';
  root.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; z-index: 10;
    font-family: 'Segoe UI', system-ui, sans-serif; color: #e8ecf5;
  `;

  // Top timeline bar
  const bar = document.createElement('div');
  bar.style.cssText = `
    position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 12px; pointer-events: auto;
    background: rgba(10, 14, 24, 0.65); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.14); border-radius: 14px;
    padding: 10px 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.35);
  `;

  const title = document.createElement('div');
  title.textContent = 'CITY TIMELAPSE';
  title.style.cssText = `font-size: 12px; letter-spacing: 0.14em; white-space: nowrap; color:#f4b95f;`;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(ERA_REGISTRY.length - 1);
  slider.step = '1';
  slider.value = '0';
  slider.style.cssText = `width: 250px; accent-color: #f4b95f; cursor: pointer;`;
  slider.setAttribute('aria-label', 'Time period timeline');

  // Era chips (clickable + keyboard)
  const chips = document.createElement('div');
  chips.style.cssText = `display: flex; gap: 4px;`;
  ERA_REGISTRY.forEach((spec) => {
    const chip = document.createElement('button');
    chip.textContent = spec.label;
    chip.dataset.era = spec.id;
    chip.style.cssText = `
      pointer-events: auto; cursor: pointer; border: 1px solid rgba(255,255,255,0.22);
      background: rgba(255,255,255,0.07); color: #c8d2e8; border-radius: 999px;
      padding: 5px 10px; font-size: 12px; transition: background 0.2s, color 0.2s;
    `;
    chips.appendChild(chip);
  });

  bar.append(title, slider, chips);
  root.appendChild(bar);

  // Era description line
  const desc = document.createElement('div');
  desc.style.cssText = `
    position: absolute; top: 118px; left: 50%; transform: translateX(-50%);
    font-size: 13px; color: #dce3f2; text-shadow: 0 2px 12px rgba(0,0,0,0.8);
    text-align: center; pointer-events: none; max-width: 640px;
  `;
  root.appendChild(desc);

  // Bottom-left controls
  const ctl = document.createElement('div');
  ctl.style.cssText = `
    position: absolute; left: 16px; bottom: 16px; display: flex; gap: 8px;
    pointer-events: auto;
  `;
  const muteBtn = makeButton('🔇 Mute');
  const qualityBtn = makeButton('⚙ Quality: High');
  ctl.append(muteBtn, qualityBtn);
  root.appendChild(ctl);

  // Bottom-right hint
  const hint = document.createElement('div');
  hint.style.cssText = `
    position: absolute; right: 16px; bottom: 16px; font-size: 12px; color: rgba(220,227,242,0.75);
    text-align: right; text-shadow: 0 2px 10px rgba(0,0,0,0.8); pointer-events: none;
  `;
  hint.innerHTML = 'Drag to orbit · scroll to zoom · right-drag to pan<br/>Use ← → or the slider to travel time';
  root.appendChild(hint);

  const eraTitle = document.createElement('div');
  eraTitle.style.cssText = `
    position: absolute; top: 66px; left: 50%; transform: translateX(-50%);
    font-size: 22px; font-weight: 600; letter-spacing: 0.04em; color: #fff;
    text-shadow: 0 3px 18px rgba(0,0,0,0.85); pointer-events: none;
  `;
  root.appendChild(eraTitle);

  document.body.appendChild(root);

  let currentEra: EraId = ERA_REGISTRY[0].id;

  // Wire events
  function applyEra(era: EraId): void {
    currentEra = era;
    const spec = getEraSpec(era);
    eraTitle.textContent = spec.year.toString();
    desc.textContent = spec.description;
    slider.value = String(ERA_REGISTRY.indexOf(spec));
    slider.setAttribute('aria-valuetext', `${spec.year} — ${spec.description}`);
    chips.querySelectorAll('button').forEach((b) => {
      const active = (b as HTMLButtonElement).dataset.era === era;
      (b as HTMLButtonElement).style.background = active
        ? 'rgba(244,185,95,0.85)'
        : 'rgba(255,255,255,0.07)';
      (b as HTMLButtonElement).style.color = active ? '#141824' : '#c8d2e8';
    });
  }

  slider.addEventListener('input', () => {
    const idx = Number(slider.value);
    const era = ERA_REGISTRY[idx].id;
    callbacks.onEraChange(era);
    applyEra(era);
  });
  chips.querySelectorAll('button').forEach((chip) => {
    chip.addEventListener('click', () => {
      const era = (chip as HTMLButtonElement).dataset.era as EraId;
      callbacks.onEraChange(era);
      applyEra(era);
    });
  });
  muteBtn.addEventListener('click', () => callbacks.onToggleMute());
  qualityBtn.addEventListener('click', () => callbacks.onToggleQuality());

  // Keyboard: travel eras from anywhere except when focus is inside the HUD
  // (so the slider's native arrow/home/end keys keep working).
  const onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as Node | null;
    if (target && root.contains(target)) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    let nxt = ERA_REGISTRY.findIndex((s) => s.id === currentEra);
    if (e.key === 'ArrowRight') nxt = Math.min(nxt + 1, ERA_REGISTRY.length - 1);
    else if (e.key === 'ArrowLeft') nxt = Math.max(nxt - 1, 0);
    else if (e.key === 'Home') nxt = 0;
    else if (e.key === 'End') nxt = ERA_REGISTRY.length - 1;
    const era = ERA_REGISTRY[nxt].id;
    callbacks.onEraChange(era);
    applyEra(era);
  };
  window.addEventListener('keydown', onKeyDown);

  applyEra(currentEra);

  const ui: CityUi = {
    root,
    setEra(era: EraId): void {
      applyEra(era);
    },
    setMuted(muted: boolean): void {
      muteBtn.textContent = muted ? '🔈 Unmute' : '🔇 Mute';
    },
    setLowQuality(low: boolean): void {
      qualityBtn.textContent = low ? '⚙ Quality: Low' : '⚙ Quality: High';
    },
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown);
      root.remove();
    },
  };
  return ui;
}

function makeButton(text: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = `
    pointer-events: auto; cursor: pointer; border: 1px solid rgba(255,255,255,0.22);
    background: rgba(10,14,24,0.55); color: #e8ecf5; border-radius: 10px;
    padding: 8px 12px; font-size: 12px; backdrop-filter: blur(6px);
    transition: background 0.2s;
  `;
  return btn;
}