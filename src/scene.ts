/**
 * src/scene.ts
 * ----------------------------------------------------------------------------
 * Bootstrap / composition root for the "City Timelapse 1945-2055" scene.
 *
 * The EraController is instantiated FIRST, before any builder, so that every
 * downstream system (building / vehicle / storefront / pedestrian builders,
 * the procedural audio mixer and the particle system) can subscribe to it once
 * and never touch the HUD directly.
 *
 * This phase (Era data model, asset registry & timeline binding) ships a working
 * boot: the controller + timeline HUD, plus a lightweight era-reactive backdrop
 * that crossfades the era palette so the binding is visibly correct. The actual
 * 3D geometry / textures are added by downstream builder tasks, which will each
 * call `controller.subscribe(...)` against the single controller instance built
 * here.
 * ----------------------------------------------------------------------------
 */

import { ERA_BY_ID } from './eras';
import { EraController } from './eraController';
import { createTimeline } from './hud/timeline';

// ---------------------------------------------------------------------------
// Tiny color helpers (kept local — no three.js / renderer dependency yet)
// ---------------------------------------------------------------------------

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toChannel(value: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(value)));
  return clamped.toString(16).padStart(2, '0');
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return `#${toChannel(ar + (br - ar) * t)}${toChannel(ag + (bg - ag) * t)}${toChannel(ab + (bb - ab) * t)}`;
}

// ---------------------------------------------------------------------------
// Scene bootstrap
// ---------------------------------------------------------------------------

/**
 * Build the scene: create the EraController, mount the timeline HUD, and attach
 * an era-reactive backdrop. Returns the controller so downstream tasks (or a
 * future 3D renderer) can subscribe to it.
 */
export function bootstrapScene(): EraController {
  // 1. Single source of truth, created before anything else.
  const controller = new EraController({ initialEra: '1945' });

  // 2. Era-reactive backdrop (placeholder visuals until builders attach).
  const stage = document.createElement('div');
  stage.style.position = 'fixed';
  stage.style.inset = '0';
  stage.style.zIndex = '0';
  stage.style.transition = 'none';
  document.body.appendChild(stage);

  const caption = document.createElement('div');
  caption.style.position = 'fixed';
  caption.style.left = '0';
  caption.style.right = '0';
  caption.style.bottom = '26px';
  caption.style.zIndex = '1';
  caption.style.textAlign = 'center';
  caption.style.color = 'rgba(255,255,255,0.92)';
  caption.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  caption.style.textShadow = '0 2px 18px rgba(0,0,0,0.7)';
  caption.style.pointerEvents = 'none';
  document.body.appendChild(caption);

  const initial = ERA_BY_ID[controller.currentEra];
  caption.innerHTML = `<div style="font-size:18px;font-weight:700;letter-spacing:.5px">${initial.label}</div>`
    + `<div style="font-size:13px;opacity:.8;margin-top:4px">${initial.tagline}</div>`;

  // 3. Subscribe: crossfade palette colors every frame, update caption on settle.
  controller.subscribe({
    onEraChange(snapshot) {
      const from = ERA_BY_ID[snapshot.currentEra].palette;
      const to = ERA_BY_ID[snapshot.targetEra].palette;
      const t = snapshot.progress;
      const sky = lerpHex(from.sky, to.sky, t);
      const fog = lerpHex(from.fog, to.fog, t);
      const ground = lerpHex(from.ground, to.ground, t);
      stage.style.background = `linear-gradient(180deg, ${sky} 0%, ${fog} 55%, ${ground} 100%)`;
    },
    onEraSettle(era) {
      const descriptor = ERA_BY_ID[era];
      caption.innerHTML = `<div style="font-size:18px;font-weight:700;letter-spacing:.5px">${descriptor.label}</div>`
        + `<div style="font-size:13px;opacity:.8;margin-top:4px">${descriptor.tagline}</div>`;
    },
  });

  // 4. Mount the timeline HUD (depends only on the controller).
  createTimeline(document.body, controller);

  // 5. Downstream builder / audio / particle tasks subscribe to `controller`
  //    here. They are intentionally not imported in this phase.
  return controller;
}

// Auto-boot in the browser (loaded via index.html -> /src/scene.ts).
bootstrapScene();
