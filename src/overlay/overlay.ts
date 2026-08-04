import { Vector3, type Camera } from 'three';
import type { CityGrid, StreetSegment } from '../city';
import type { ControlMode } from '../controls/modeSwitch';
import './overlay.css';

/**
 * In-experience HUD overlay: a centered crosshair, a controls hint and a
 * minimap that renders the city street grid from `city-generation` with the
 * player's live position and facing direction.
 *
 * The whole overlay root is pointer-events: none (see overlay.css), so clicks
 * pass straight through to the WebGL canvas and Pointer Lock activation is
 * never blocked. No overlay element captures input.
 */

export interface Overlay {
  /** Fixed, full-screen overlay root (pointer-events: none). */
  root: HTMLDivElement;
  /** Minimap that redraws the player marker every frame. */
  minimap: Minimap;
}

/** Map a world XZ coordinate into minimap canvas pixels (north-up, +Z down). */
export function worldToMap(
  x: number,
  z: number,
  halfExtent: number,
  size: number,
): { x: number; y: number } {
  const span = halfExtent * 2;
  return {
    x: ((x + halfExtent) / span) * size,
    y: ((z + halfExtent) / span) * size,
  };
}

/**
 * Angle (radians) a world-space facing direction (dx, dz) makes on the map
 * canvas. The canvas Y axis grows with +Z, so a -Z facing (north) yields
 * -PI/2, i.e. pointing up the map.
 */
export function facingAngle(dirX: number, dirZ: number): number {
  return Math.atan2(dirZ, dirX);
}

/**
 * Build the HUD overlay DOM and its minimap. `grid` comes straight from
 * `generateCity` so the map shares the exact coordinate system used for the
 * rendered streets and the walk controls.
 */
export function createOverlay(grid: CityGrid): Overlay {
  const root = document.createElement('div');
  root.id = 'hud-root';
  root.className = 'hud-root';
  // Guarantee clicks pass through to the canvas even before CSS loads; the
  // stylesheet also sets pointer-events: none on every overlay element.
  root.style.pointerEvents = 'none';

  // ---- Crosshair ------------------------------------------------------
  const crosshair = document.createElement('div');
  crosshair.className = 'crosshair';
  crosshair.setAttribute('aria-hidden', 'true');
  const centerDot = document.createElement('div');
  centerDot.className = 'crosshair-center';
  crosshair.appendChild(centerDot);
  root.appendChild(crosshair);

  // ---- Controls hint ---------------------------------------------------
  const hint = document.createElement('div');
  hint.className = 'controls-hint';

  const title = document.createElement('div');
  title.className = 'controls-hint-title';
  title.textContent = 'City Explorer';

  const walkLine = document.createElement('div');
  walkLine.className = 'controls-hint-line';
  walkLine.textContent =
    'WASD / arrows to move · Mouse to look · Shift sprint · Space jump';

  const toggleLine = document.createElement('div');
  toggleLine.className = 'controls-hint-line controls-hud-toggle';
  toggleLine.textContent =
    'Press R to switch between walk and orbit view · Click to capture the mouse';

  hint.append(title, walkLine, toggleLine);
  root.appendChild(hint);

  // ---- Minimap ----------------------------------------------------------
  const minimap = new Minimap(grid);
  root.appendChild(minimap.container);

  return { root, minimap };
}

/** Keep the controls hint in sync with the active control mode. */
export function updateOverlayMode(root: HTMLElement, mode: ControlMode): void {
  const toggle = root.querySelector<HTMLElement>('.controls-hud-toggle');
  if (!toggle) {
    return;
  }
  if (mode === 'walk') {
    toggle.textContent =
      'Press R to switch between walk and orbit view · Click to capture the mouse';
  } else {
    toggle.textContent =
      'Orbit view · drag to rotate, scroll to zoom · Press R to return to walk mode';
  }
}

/**
 * Canvas minimap. The street grid is drawn once into a static layer (it never
 * changes), and every frame only the small player layer is cleared and
 * redrawn, so the per-frame cost stays a couple of canvas calls.
 */
export class Minimap {
  readonly container: HTMLDivElement;
  private readonly gridCanvas: HTMLCanvasElement;
  private readonly layerCanvas: HTMLCanvasElement;
  private readonly layerContext: CanvasRenderingContext2D | null;
  private readonly size: number;
  private readonly halfExtent: number;
  private readonly tempDir = new Vector3();

  constructor(grid: CityGrid) {
    this.halfExtent = grid.halfExtent;
    const cssSize = 180;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = Math.round(cssSize * dpr);

    this.container = document.createElement('div');
    this.container.className = 'minimap';

    this.gridCanvas = document.createElement('canvas');
    this.gridCanvas.className = 'minimap-grid';
    this.gridCanvas.width = this.size;
    this.gridCanvas.height = this.size;

    this.layerCanvas = document.createElement('canvas');
    this.layerCanvas.className = 'minimap-layer';
    this.layerCanvas.width = this.size;
    this.layerCanvas.height = this.size;

    this.container.append(this.gridCanvas, this.layerCanvas);
    this.layerContext = this.layerCanvas.getContext('2d');

    this.drawGrid(grid.segments);
  }

  /** Redraw the player marker for the current camera pose (call per frame). */
  update(camera: Camera): void {
    const ctx = this.layerContext;
    if (!ctx) {
      return;
    }
    const size = this.size;
    ctx.clearRect(0, 0, size, size);

    const { x: mx, y: my } = worldToMap(
      camera.position.x,
      camera.position.z,
      this.halfExtent,
      size,
    );

    // Keep the marker on the map even when orbit mode flies outside the grid.
    const inset = 8;
    const cx = Math.min(Math.max(mx, inset), size - inset);
    const cy = Math.min(Math.max(my, inset), size - inset);

    // Facing direction projected onto the XZ plane, then onto the canvas.
    this.tempDir.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const angle = facingAngle(this.tempDir.x, this.tempDir.z);

    // Direction arrow (rotated by the facing angle).
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5.5);
    ctx.lineTo(-6, 5.5);
    ctx.closePath();
    ctx.fillStyle = '#ffd54f';
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 22, 28, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Position dot at the player's exact location.
    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff7e0';
    ctx.fill();
  }

  /** Draw the static street grid once (roads darker, sidewalks lighter). */
  private drawGrid(segments: readonly StreetSegment[]): void {
    const ctx = this.gridCanvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, this.size, this.size);

    for (const seg of segments) {
      const topLeft = worldToMap(
        seg.x - seg.width / 2,
        seg.z - seg.depth / 2,
        this.halfExtent,
        this.size,
      );
      const w = (seg.width / (this.halfExtent * 2)) * this.size;
      const h = (seg.depth / (this.halfExtent * 2)) * this.size;
      ctx.fillStyle = seg.kind === 'road' ? '#555a63' : '#6d675f';
      ctx.fillRect(topLeft.x, topLeft.y, w, h);
    }
  }
}
