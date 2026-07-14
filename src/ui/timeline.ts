import type { EraConfig } from '../types';
import { ERA_LIST } from '../config/eras';

export interface TimelineCallbacks {
  onEraSelect: (index: number) => void;
  onScrub: (progress: number) => void;
  onScrubEnd: () => void;
  onToggleAudio: () => void;
  onToggleAuto: () => void;
  onResetView: () => void;
  isAudioOn: () => boolean;
  isAutoOn: () => boolean;
}

/**
 * Builds and owns the top timeline (year ticks + invisible range slider) and
 * the bottom HUD (audio toggle, auto-play, reset view). All elements are
 * semantic, keyboard-accessible, and aria-labelled.
 */
export class TimelineUI {
  private root: HTMLElement;
  private yearEl: HTMLElement;
  private labelEl: HTMLElement;
  private fillEl: HTMLElement;
  private rangeEl: HTMLInputElement;
  private ticks: HTMLButtonElement[] = [];
  private audioBtn: HTMLButtonElement;
  private autoBtn: HTMLButtonElement;
  private resetBtn: HTMLButtonElement;

  constructor(private cb: TimelineCallbacks) {
    // Timeline
    const host = document.getElementById('timeline')!;
    host.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'timeline-head';
    this.yearEl = document.createElement('div');
    this.yearEl.className = 'timeline-year';
    this.yearEl.textContent = String(ERA_LIST[0].year);
    this.labelEl = document.createElement('div');
    this.labelEl.className = 'timeline-label';
    this.labelEl.textContent = ERA_LIST[0].name + ' · ' + ERA_LIST[0].tagline;
    head.append(this.yearEl, this.labelEl);
    host.appendChild(head);

    const track = document.createElement('div');
    track.className = 'timeline-track';
    const rail = document.createElement('div');
    rail.className = 'timeline-rail';
    this.fillEl = document.createElement('div');
    this.fillEl.className = 'timeline-fill';
    rail.appendChild(this.fillEl);

    this.rangeEl = document.createElement('input');
    this.rangeEl.type = 'range';
    this.rangeEl.className = 'timeline-range';
    this.rangeEl.min = '0';
    this.rangeEl.max = '100';
    this.rangeEl.value = '0';
    this.rangeEl.step = '0.1';
    this.rangeEl.setAttribute('aria-label', 'Era scrubber, drag to travel through time');

    const ticksWrap = document.createElement('div');
    ticksWrap.className = 'ticks';
    ERA_LIST.forEach((era, i) => {
      const btn = document.createElement('button');
      btn.className = 'tick';
      btn.type = 'button';
      btn.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      btn.setAttribute('aria-label', `${era.year} ${era.name}`);
      const dot = document.createElement('span');
      dot.className = 'tick-dot';
      const yr = document.createElement('span');
      yr.textContent = String(era.year);
      btn.append(dot, yr);
      btn.addEventListener('click', () => this.cb.onEraSelect(i));
      this.ticks.push(btn);
      ticksWrap.appendChild(btn);
    });

    track.append(rail, this.rangeEl, ticksWrap);
    host.appendChild(track);

    // Range interactions
    this.rangeEl.addEventListener('input', () => {
      const v = Number(this.rangeEl.value) / 100;
      this.setFill(v);
      this.cb.onScrub(v);
    });
    this.rangeEl.addEventListener('change', () => this.cb.onScrubEnd());

    // HUD
    const hud = document.getElementById('hud')!;
    hud.innerHTML = '';

    const hint = document.createElement('span');
    hint.className = 'hud-hint';
    hint.textContent = 'Drag to orbit · Scroll to zoom';

    this.audioBtn = this.makeBtn('audio', '🔊 Sound', () => this.cb.onToggleAudio());
    this.autoBtn = this.makeBtn('auto', '⏱ Auto-Play', () => this.cb.onToggleAuto());
    this.resetBtn = this.makeBtn('reset', '⟳ Reset View', () => this.cb.onResetView());

    hud.append(this.audioBtn, this.autoBtn, this.resetBtn, hint);
    this.syncHud();

    this.root = host;
  }

  private makeBtn(id: string, label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hud-btn';
    btn.id = 'hud-' + id;
    btn.innerHTML = `<span class="dot" aria-hidden="true"></span>${label}`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private setFill(v: number): void {
    this.fillEl.style.width = (v * 100).toFixed(1) + '%';
  }

  /** Update the timeline visuals from a continuous 0..1 progress. */
  setProgress(v: number): void {
    this.rangeEl.value = String(v * 100);
    this.setFill(v);
    // Determine nearest era index
    const idx = Math.round(v * (ERA_LIST.length - 1));
    this.ticks.forEach((t, i) => t.setAttribute('aria-pressed', i === idx ? 'true' : 'false'));
  }

  /** Snap UI to a specific era (no transition). */
  setEra(index: number, config: EraConfig): void {
    const v = index / (ERA_LIST.length - 1);
    this.rangeEl.value = String(v * 100);
    this.setFill(v);
    this.yearEl.textContent = String(config.year);
    this.labelEl.textContent = config.name + ' · ' + config.tagline;
    this.ticks.forEach((t, i) => t.setAttribute('aria-pressed', i === index ? 'true' : 'false'));
  }

  /** Update year/label text during a live transition. */
  setYearLabel(year: number, name: string, tagline: string): void {
    this.yearEl.textContent = String(year);
    this.labelEl.textContent = name + ' · ' + tagline;
  }

  private syncHud(): void {
    this.audioBtn.setAttribute('aria-pressed', String(this.cb.isAudioOn()));
    this.audioBtn.innerHTML =
      `<span class="dot" aria-hidden="true"></span>${this.cb.isAudioOn() ? '🔊 Sound' : '🔇 Muted'}`;
    this.autoBtn.setAttribute('aria-pressed', String(this.cb.isAutoOn()));
  }

  refreshHud(): void {
    this.syncHud();
  }

  get element(): HTMLElement {
    return this.root;
  }
}
