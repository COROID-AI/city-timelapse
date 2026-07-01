// DOM timeline UI: 5 year stops + a draggable slider, a mute button, and a
// title overlay. Pure DOM (no framework) per the task's low-complexity constraint.

import { ERAS } from './eras';

export interface UIHandle {
  setActive: (index: number) => void;
  setMuted: (muted: boolean) => void;
}

export interface UICallbacks {
  onEraChange: (index: number) => void;
}

const MUTE_ON = '🔇';
const MUTE_OFF = '🔊';

export function buildUI(root: HTMLElement, cb: UICallbacks): UIHandle {
  // Title.
  const title = document.createElement('div');
  title.className = 'title';
  title.innerHTML = '<h1>City Timelapse</h1><p>80 Years on One Block</p>';
  root.appendChild(title);

  // Timeline bar.
  const bar = document.createElement('div');
  bar.id = 'timeline';

  const yearEl = document.createElement('div');
  yearEl.className = 'tl-year';
  yearEl.textContent = String(ERAS[0].year);

  const hintEl = document.createElement('div');
  hintEl.className = 'tl-hint';
  hintEl.textContent = 'Drag or click a year';

  const slider = document.createElement('input');
  slider.className = 'tl-slider';
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(ERAS.length - 1);
  slider.step = '1';
  slider.value = '0';

  const stops = document.createElement('div');
  stops.className = 'tl-stops';

  const buttons: HTMLButtonElement[] = [];
  ERAS.forEach((era, i) => {
    const btn = document.createElement('button');
    btn.className = 'tl-stop' + (i === 0 ? ' active' : '');
    btn.textContent = String(era.year);
    btn.dataset.index = String(i);
    btn.addEventListener('click', () => select(i));
    stops.appendChild(btn);
    buttons.push(btn);
  });

  bar.appendChild(yearEl);
  bar.appendChild(hintEl);
  bar.appendChild(slider);
  bar.appendChild(stops);
  root.appendChild(bar);

  // Mute control.
  const mute = document.createElement('button');
  mute.id = 'mute';
  mute.title = 'Toggle ambient audio';
  mute.textContent = MUTE_OFF;
  root.appendChild(mute);

  function select(index: number): void {
    const clamped = Math.max(0, Math.min(ERAS.length - 1, index));
    slider.value = String(clamped);
    yearEl.textContent = String(ERAS[clamped].year);
    buttons.forEach((b, i) => b.classList.toggle('active', i === clamped));
    cb.onEraChange(clamped);
  }

  slider.addEventListener('input', () => {
    select(parseInt(slider.value, 10) || 0);
  });

  return {
    setActive: (index) => select(index),
    setMuted: (muted) => {
      mute.textContent = muted ? MUTE_ON : MUTE_OFF;
    },
  };
}
