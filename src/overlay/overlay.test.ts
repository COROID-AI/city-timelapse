import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCity } from '../city';
import { createOverlay, facingAngle, worldToMap } from './overlay';
import type { CityGrid } from '../city';

type FakeCtx = ReturnType<typeof makeContext>;

function makeContext() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  };
}

interface FakeElement {
  tag: string;
  className: string;
  style: Record<string, string>;
  width: number;
  height: number;
  textContent: string;
  setAttribute: ReturnType<typeof vi.fn>;
  appendChild: ReturnType<typeof vi.fn>;
  append: ReturnType<typeof vi.fn>;
  querySelector: ReturnType<typeof vi.fn>;
  getContext: ReturnType<typeof vi.fn>;
  context: FakeCtx;
}

let created: FakeElement[] = [];

/** Minimal DOM stub so createOverlay can run in the node test environment. */
function installFakeDom(): void {
  created = [];
  const make = (tag: string): FakeElement => {
    const element: FakeElement = {
      tag,
      className: '',
      style: {},
      width: 0,
      height: 0,
      textContent: '',
      setAttribute: vi.fn(),
      appendChild: vi.fn(),
      append: vi.fn(),
      querySelector: vi.fn(() => null),
      getContext: vi.fn(),
      context: makeContext(),
    };
    element.getContext.mockReturnValue(element.context);
    created.push(element);
    return element;
  };
  (globalThis as Record<string, unknown>).document = {
    createElement: (tag: string) => make(tag),
  };
  (globalThis as Record<string, unknown>).window = { devicePixelRatio: 1 };
}

/** Elements created by the latest installFakeDom() call. */
function createdElements(): FakeElement[] {
  return created;
}

function restoreGlobals(): void {
  const g = globalThis as Record<string, unknown>;
  delete g.document;
  delete g.window;
}

function makeGrid(): CityGrid {
  return generateCity({ seed: 42 }).grid;
}

describe('worldToMap', () => {
  it('maps the world origin to the canvas center', () => {
    expect(worldToMap(0, 0, 125, 180)).toEqual({ x: 90, y: 90 });
  });

  it('maps the grid corners to the canvas corners', () => {
    expect(worldToMap(-125, -125, 125, 180)).toEqual({ x: 0, y: 0 });
    expect(worldToMap(125, 125, 125, 180)).toEqual({ x: 180, y: 180 });
  });

  it('preserves world-space ratios (+Z grows downward, north-up)', () => {
    const { x, y } = worldToMap(0, 78, 125, 180);
    expect(x).toBeCloseTo(90, 6);
    // z=78 of halfExtent 125 → below center (larger canvas y).
    expect(y).toBeGreaterThan(90);
  });
});

describe('facingAngle', () => {
  it('points up the map when facing -Z (north)', () => {
    expect(facingAngle(0, -1)).toBeCloseTo(-Math.PI / 2, 6);
  });
  it('points down when facing +Z (south)', () => {
    expect(facingAngle(0, 1)).toBeCloseTo(Math.PI / 2, 6);
  });
  it('points right when facing +X (east)', () => {
    expect(facingAngle(1, 0)).toBeCloseTo(0, 6);
  });
  it('points left when facing -X (west)', () => {
    expect(facingAngle(-1, 0)).toBeCloseTo(Math.PI, 6);
  });
});

describe('createOverlay', () => {
  beforeEach(() => {
    installFakeDom();
  });
  afterEach(() => {
    restoreGlobals();
  });

  it('builds a pointer-transparent root with crosshair, hint and minimap', () => {
    const created = createdElements();
    const overlay = createOverlay(makeGrid());

    expect(overlay.root.className).toContain('hud-root');
    expect(overlay.root.style.pointerEvents).toBe('none');

    // Crosshair, hint and minimap elements exist.
    expect(created.some((e) => e.className === 'crosshair')).toBe(true);
    expect(created.some((e) => e.className === 'controls-hint')).toBe(true);
    expect(created.some((e) => e.className === 'minimap')).toBe(true);

    // Hint text covers WASD movement, mouse look and the orbit toggle.
    const texts = created.filter((e) => e.textContent).map((e) => e.textContent);
    expect(texts.join(' ')).toMatch(/WASD/);
    expect(texts.join(' ')).toMatch(/orbit/);
  });

  it('draws the street grid once into the grid canvas', () => {
    const created = createdElements();
    const { grid } = generateCity({ seed: 42 });
    createOverlay(grid);
    const gridCanvas = created.find((e) => e.className === 'minimap-grid');
    expect(gridCanvas).toBeDefined();
    // One fillRect per street segment (roads + sidewalks).
    expect(gridCanvas!.context.fillRect).toHaveBeenCalledTimes(grid.segments.length);
  });

  it('updates the player marker layer from the camera pose', () => {
    const created = createdElements();
    const overlay = createOverlay(makeGrid());
    const layerCanvas = created.find((e) => e.className === 'minimap-layer');
    const layerContext = layerCanvas!.context;

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1); // facing -Z (north / up on the map)

    overlay.minimap.update(camera);
    expect(layerContext.clearRect).toHaveBeenCalledTimes(1);
    // Arrow fill + position dot fill.
    expect(layerContext.fill).toHaveBeenCalledTimes(2);
    // Arrow is rotated to the facing direction.
    expect(layerContext.rotate).toHaveBeenCalledTimes(1);
  });
});

describe('updateOverlayMode', () => {
  beforeEach(() => {
    installFakeDom();
  });
  afterEach(() => {
    restoreGlobals();
  });

  it('switches the toggle hint between walk and orbit text', async () => {
    const overlay = createOverlay(makeGrid());
    const { updateOverlayMode } = await import('./overlay');
    const root = overlay.root;

    const toggle = { textContent: '' };
    (root.querySelector as unknown as ReturnType<typeof vi.fn>).mockReturnValue(toggle);

    updateOverlayMode(root, 'walk');
    expect(toggle.textContent).toMatch(/walk and orbit/);
    updateOverlayMode(root, 'orbit');
    expect(toggle.textContent).toMatch(/Orbit view/);
    expect(toggle.textContent).toMatch(/return to walk/);
  });
});
