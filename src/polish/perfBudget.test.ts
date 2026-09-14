/**
 * PerfBudget tests — pixel-ratio cap, draw-call accounting/enforcement and
 * the perf overlay.
 *
 * Proves, headlessly:
 *
 *  - the renderer pixel ratio is capped at <= 2 (handles 1x / 2x / 3x and
 *    missing values), and the capped backing size is derived correctly,
 *  - draw calls are counted per scene graph (InstancedMesh = one draw),
 *  - the budget enforcer restores an over-budget stage by hiding
 *    lowest-priority polish groups first,
 *  - `?perf=1` enables the overlay, which mounts bottom-left (never over the
 *    top timeline slider), reports live fps/pixelRatio/draws/era, and
 *    unsubscribes/removes itself on dispose.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  MAX_PIXEL_RATIO,
  POLISH_DRAW_CALL_BUDGET,
  capPixelRatio,
  cappedRenderSize,
  countInstancedMeshes,
  countPolishDrawCalls,
  countSceneDrawCalls,
  createPerfOverlay,
  enforceDrawCallBudget,
  isPerfOverlayRequested,
  PerfMeter,
  POLISH_PRIORITIES,
} from './perfBudget';

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  container.remove();
  document.body.replaceChildren();
});

describe('pixel-ratio cap (src/polish/perfBudget.ts)', () => {
  it('caps the device pixel ratio at the guardrail (<= 2)', () => {
    expect(MAX_PIXEL_RATIO).toBe(2);
    expect(capPixelRatio(1)).toBe(1);
    expect(capPixelRatio(2)).toBe(2);
    expect(capPixelRatio(3)).toBe(2);
    expect(capPixelRatio(5)).toBe(2);
    expect(capPixelRatio(0)).toBe(1);
    expect(capPixelRatio(-2)).toBe(1);
    expect(capPixelRatio(Number.NaN)).toBe(1);
    expect(capPixelRatio(Infinity)).toBe(1);
    // Custom caps stay supported but never exceed the passed max.
    expect(capPixelRatio(4, 1.5)).toBe(1.5);
  });

  it('derives capped backing sizes (css * min(dpr, 2))', () => {
    expect(cappedRenderSize(1920, 1080, 1)).toEqual({
      width: 1920,
      height: 1080,
      pixelRatio: 1,
    });
    expect(cappedRenderSize(1920, 1080, 2)).toEqual({
      width: 3840,
      height: 2160,
      pixelRatio: 2,
    });
    // 3x display renders at the 2x cap, not 3x.
    expect(cappedRenderSize(1920, 1080, 3)).toEqual({
      width: 3840,
      height: 2160,
      pixelRatio: 2,
    });
    expect(cappedRenderSize(800, 600, 1.5)).toEqual({
      width: 1200,
      height: 900,
      pixelRatio: 1.5,
    });
  });

  it('detects the ?perf=1 overlay request', () => {
    expect(isPerfOverlayRequested('?perf=1')).toBe(true);
    expect(isPerfOverlayRequested('?perf=1&tool=qa')).toBe(true);
    expect(isPerfOverlayRequested('?perf=0')).toBe(false);
    expect(isPerfOverlayRequested('?era=1985')).toBe(false);
    expect(isPerfOverlayRequested('')).toBe(false);
  });
});

describe('draw-call accounting and enforcement', () => {
  it('counts every drawable; an InstancedMesh counts once regardless of instances', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    root.add(new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), new THREE.MeshBasicMaterial()));
    const instanced = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial(),
      250,
    );
    root.add(instanced);
    const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial());
    root.add(line);

    expect(countSceneDrawCalls(root)).toBe(4);
    expect(countInstancedMeshes(root)).toBe(1);
  });

  it('counts only polish-tagged drawables for the additive-layer budget', () => {
    const root = new THREE.Group();
    const plain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const polishA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    polishA.userData = { polish: true, polishKind: 'windowGlow' };
    const polishInstanced = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.1),
      new THREE.MeshBasicMaterial(),
      120,
    );
    polishInstanced.userData = { polish: true, polishKind: 'planter' };
    root.add(plain, polishA, polishInstanced);

    expect(countSceneDrawCalls(root)).toBe(3);
    expect(countPolishDrawCalls(root)).toBe(2);

    // Hiding a polish drawable removes it from the additive-layer count.
    polishA.visible = false;
    expect(countPolishDrawCalls(root)).toBe(1);
  });

  it('enforceDrawCallBudget hides lowest-priority polish groups until under budget', () => {
    const root = new THREE.Group();
    for (let i = 0; i < 8; i += 1) {
      root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    }
    const wear = new THREE.Group();
    wear.name = 'polish-wear';
    wear.userData = { polishGroup: true, polishPriority: POLISH_PRIORITIES.wear, polishKind: 'wear' };
    const props = new THREE.Group();
    props.name = 'polish-props';
    props.userData = { polishGroup: true, polishPriority: POLISH_PRIORITIES.props, polishKind: 'props' };
    const glows = new THREE.Group();
    glows.name = 'polish-glows';
    glows.userData = { polishGroup: true, polishPriority: POLISH_PRIORITIES.glows, polishKind: 'glows' };
    // wear: 4 draws, props: 2, glows: 3 -> total 8 + 9 = 17.
    for (let i = 0; i < 4; i += 1) {
      wear.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    }
    for (let i = 0; i < 2; i += 1) {
      props.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    }
    for (let i = 0; i < 3; i += 1) {
      glows.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    }
    root.add(wear, props, glows);

    expect(countSceneDrawCalls(root)).toBe(17);
    const result = enforceDrawCallBudget(root, 12);
    expect(result.before).toBe(17);
    expect(result.after).toBeLessThanOrEqual(12);
    // wear (4) then props (2) hid: 17 -> 13 -> 11. glows stay.
    expect(result.hiddenGroups).toEqual(['polish-wear', 'polish-props']);
    expect(wear.visible).toBe(false);
    expect(props.visible).toBe(false);
    expect(glows.visible).toBe(true);
    expect(result.overBudget).toBe(false);
  });

  it('reports still over budget when even every polish group is hidden', () => {
    const root = new THREE.Group();
    for (let i = 0; i < 10; i += 1) {
      root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    }
    const wear = new THREE.Group();
    wear.name = 'polish-wear';
    wear.userData = { polishGroup: true, polishPriority: POLISH_PRIORITIES.wear };
    wear.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    root.add(wear);

    const result = enforceDrawCallBudget(root, 5);
    expect(result.after).toBe(10); // only the polish group is hideable
    expect(result.overBudget).toBe(true);
  });
});

describe('PerfMeter', () => {
  it('tracks smoothed and worst-case fps from frame deltas', () => {
    const meter = new PerfMeter();
    for (let i = 0; i < 60; i += 1) {
      meter.record(1 / 60);
    }
    expect(meter.frameCount).toBe(60);
    expect(meter.reading.fps).toBeGreaterThan(55);
    expect(meter.reading.fps).toBeLessThanOrEqual(61);

    // A stutter frame drags the min down but not the smoothed fps far.
    meter.record(1 / 20);
    expect(meter.reading.minFps).toBeLessThanOrEqual(20);
    expect(meter.reading.minFps).toBeGreaterThan(0);
    expect(meter.reading.frameCount).toBe(61);

    // Invalid deltas are ignored.
    meter.record(0);
    meter.record(Number.NaN);
    expect(meter.reading.frameCount).toBe(61);

    meter.reset();
    expect(meter.reading.frameCount).toBe(0);
  });
});

describe('PerfOverlay (bottom-left panel, ?perf=1)', () => {
  function stubEngine(): {
    engine: {
      onFrame(cb: (dt: number) => void): () => void;
      getSize(): { width: number; height: number };
    };
    handler: ((dt: number) => void) | null;
    unsubscribed: boolean;
  } {
    const state: { handler: ((dt: number) => void) | null; unsubscribed: boolean } = {
      handler: null,
      unsubscribed: false,
    };
    return {
      engine: {
        onFrame(cb) {
          state.handler = cb;
          return () => {
            state.unsubscribed = true;
            state.handler = null;
          };
        },
        getSize() {
          return { width: 1920, height: 1080 };
        },
      },
      get handler() {
        return state.handler;
      },
      get unsubscribed() {
        return state.unsubscribed;
      },
    };
  }

  it('mounts a bottom-left panel reporting fps, pixel ratio, draws and era', () => {
    const stub = stubEngine();
    const stage = new THREE.Group();
    stage.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    const overlay = createPerfOverlay({
      container,
      engine: stub.engine,
      stage,
      getEra: () => '1985',
    });

    expect(overlay.element).toBeNull();
    overlay.attach();
    expect(overlay.element).not.toBeNull();
    expect(container.contains(overlay.element)).toBe(true);

    const element = overlay.element!;
    // Guardrail: fixed to the bottom-left corner, far from the top slider.
    expect(element.style.position).toBe('fixed');
    expect(element.style.bottom).toBe('12px');
    expect(element.style.left).toBe('12px');
    expect(element.dataset.polishPerf).toBe('overlay');

    // Frame deltas flow into the meter; the panel redraws on refresh frames.
    stub.handler?.(1 / 60);
    overlay.update();
    const text = element.textContent ?? '';
    expect(text).toContain('draws');
    expect(text).toContain(`polish 0/${POLISH_DRAW_CALL_BUDGET}`);
    expect(text).toContain('1985');

    overlay.dispose();
    expect(overlay.element).toBeNull();
    expect(stub.unsubscribed).toBe(true);
    expect(container.contains(element)).toBe(false);
  });

  it('falls back to document.body when no container is given and detach is safe', () => {
    const stub = stubEngine();
    const overlay = createPerfOverlay({
      container: null,
      engine: stub.engine,
      stage: new THREE.Group(),
      getEra: () => '1945',
    });
    overlay.attach();
    expect(overlay.element).not.toBeNull();
    expect(document.body.contains(overlay.element)).toBe(true);
    overlay.detach();
    expect(overlay.element).toBeNull();
    overlay.dispose();
    expect(stub.unsubscribed).toBe(true);
  });
});