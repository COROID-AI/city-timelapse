/**
 * PerfBudget — draw-call budgeting, pixel-ratio capping and the perf overlay.
 *
 * Final performance guardrails of the City Time Period Timelapse:
 *
 *  - **Pixel ratio cap**: the renderer never renders above {@link MAX_PIXEL_RATIO}
 *    (2.0). `capPixelRatio` / `cappedRenderSize` compute the capped backing
 *    resolution from the CSS size and `window.devicePixelRatio`, and the
 *    main.ts hook pushes the capped size through the engine's public
 *    `resize()` surface.
 *  - **Draw-call budget**: `countSceneDrawCalls` counts every visible
 *    drawable (Mesh, InstancedMesh, Line, Points, Sprite) on the stage, and
 *    `enforceDrawCallBudget` brings an over-budget stage back under the cap by
 *    hiding the lowest-priority polish groups first (wear -> props -> glows).
 *  - **Frame pacing**: {@link PerfMeter} tracks smoothed + minimum FPS from
 *    the engine's fixed-step deltas; the {@link PerfOverlay} (opened with
 *    `?perf=1`) renders all of these live in a small bottom-left panel that
 *    never overlaps the top timeline HUD.
 *
 * No WebGL is touched here: the overlay is plain DOM and every accounting
 * function walks the THREE scene graph, so the whole module runs headless
 * under Vitest.
 */

import * as THREE from 'three';

/** Hard cap on the effective renderer pixel ratio (never renders above 2x). */
export const MAX_PIXEL_RATIO = 2;

/**
 * Default draw-call budget for the whole visible era stage. The budget is the
 * enforced ceiling the perf overlay watches: the composer outputs (buildings,
 * street life, storefronts) measure 1011-1311 draws per era and the polished
 * layer adds only ~21-34 instanced draw calls (max measured 1332 for 2025),
 * so the ceiling sits at 1500 with headroom; the enforcer hides polish groups
 * first if the stage ever exceeds it.
 */
export const DEFAULT_DRAW_CALL_BUDGET = 1500;

/**
 * Budget for the *polish additive layer* itself (the part this task adds).
 * The composer outputs (buildings, street life, storefronts) measure
 * 1011-1311 draws per era and are owned by the producers; the polish layer
 * adds only ~21-34 instanced draw calls per era (instancing keeps hundreds
 * of glow/prop instances behind a handful of draws), far below this 450
 * ceiling. The perf overlay reports both budgets: `draws N/1500` (stage,
 * enforced) and `polish N/450` (additive layer).
 */
export const POLISH_DRAW_CALL_BUDGET = 450;

/** Polish-layer priority labels: lower numbers are hidden first when over budget. */
export const POLISH_PRIORITIES = {
  wear: 1,
  props: 2,
  glows: 3,
} as const;

// ============================================================================
// Pixel-ratio cap
// ============================================================================

/** Clamp a device pixel ratio into [1, maxRatio] (1 for missing values). */
export function capPixelRatio(
  devicePixelRatio: number,
  maxRatio: number = MAX_PIXEL_RATIO,
): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    return 1;
  }
  return Math.min(maxRatio, devicePixelRatio);
}

/** The browser's current device pixel ratio (1 in headless environments). */
export function projectDevicePixelRatio(): number {
  if (typeof window === 'undefined') {
    return 1;
  }
  return window.devicePixelRatio ?? 1;
}

/** Capped renderer backing size derived from CSS dimensions. */
export interface CappedRenderSize {
  /** Backing width in device pixels. */
  readonly width: number;
  /** Backing height in device pixels. */
  readonly height: number;
  /** The effective (capped) pixel ratio actually applied. */
  readonly pixelRatio: number;
}

/**
 * Compute the backing resolution for a renderer: `cssSize * min(dpr, cap)`.
 * On a 1x display this is the CSS size (1.0x); on a 3x display it renders at
 * 2.0x — the pixel-ratio guardrail.
 */
export function cappedRenderSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  maxRatio: number = MAX_PIXEL_RATIO,
): CappedRenderSize {
  const pixelRatio = capPixelRatio(devicePixelRatio, maxRatio);
  return {
    width: Math.max(1, Math.round(cssWidth * pixelRatio)),
    height: Math.max(1, Math.round(cssHeight * pixelRatio)),
    pixelRatio,
  };
}

/** Whether the perf overlay is requested (`?perf=1`). */
export function isPerfOverlayRequested(search?: string): boolean {
  const query =
    search ??
    (typeof window !== 'undefined' && typeof window.location !== 'undefined'
      ? window.location.search
      : '');
  if (query.length === 0) {
    return false;
  }
  try {
    return new URLSearchParams(query).get('perf') === '1';
  } catch {
    return false;
  }
}

// ============================================================================
// Draw-call accounting
// ============================================================================

/** Live draw-call accounting for one scene graph. */
export interface DrawCallReport {
  /** Every drawable counted on the stage. */
  readonly drawCalls: number;
  /** The configured budget. */
  readonly budget: number;
  /** True when `drawCalls` exceeds the budget. */
  readonly overBudget: boolean;
  /** Count of Mesh primitives (InstancedMesh counted once). */
  readonly meshes: number;
  /** Count of InstancedMesh primitives. */
  readonly instancedMeshes: number;
}

interface DrawableLike {
  isMesh?: boolean;
  isLine?: boolean;
  isPoints?: boolean;
  isSprite?: boolean;
  isInstancedMesh?: boolean;
}

/**
 * Count every *visible* drawable under `root`. An `InstancedMesh` counts as
 * exactly one draw call (all instances share one). Subtrees whose `visible`
 * flag is false (budget-enforcement hides polish groups this way) do not
 * count, mirroring three.js's own render-culling rule where an invisible
 * object hides its whole subtree.
 */
export function countSceneDrawCalls(root: THREE.Object3D): number {
  let draws = 0;
  const visit = (object: THREE.Object3D): void => {
    if (!object.visible) {
      return;
    }
    const node = object as unknown as DrawableLike;
    if (node.isMesh || node.isLine || node.isPoints || node.isSprite) {
      draws += 1;
    }
    for (const child of object.children) {
      visit(child);
    }
  };
  visit(root);
  return draws;
}

/** Count `InstancedMesh` primitives under `root` (shared-geometry proof). */
export function countInstancedMeshes(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((object) => {
    const node = object as unknown as DrawableLike;
    if (node.isInstancedMesh === true) {
      count += 1;
    }
  });
  return count;
}

/**
 * Count every *visible* drawable owned by the polish layer (`userData.polish
 * === true`, set by the detail pass on each polish mesh). This is the number
 * the polish-layer budget (`POLISH_DRAW_CALL_BUDGET`) guards: the additive
 * contribution this task controls, independent of the producer baseline.
 */
export function countPolishDrawCalls(root: THREE.Object3D): number {
  let draws = 0;
  const visit = (object: THREE.Object3D): void => {
    if (!object.visible) {
      return;
    }
    const node = object as unknown as DrawableLike;
    const userData = object.userData as { polish?: boolean };
    if ((node.isMesh || node.isLine || node.isPoints || node.isSprite) && userData.polish === true) {
      draws += 1;
    }
    for (const child of object.children) {
      visit(child);
    }
  };
  visit(root);
  return draws;
}

/** One discoverable polish group (used by budget enforcement). */
export interface PolishGroupInfo {
  readonly group: THREE.Group;
  /** Lower priority hides first when the stage is over budget. */
  readonly priority: number;
  readonly kind: string;
}

/** Polish groups — tagged via `userData.polishGroup === true`. */
export function collectPolishGroups(root: THREE.Object3D): PolishGroupInfo[] {
  const found: PolishGroupInfo[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Group)) {
      return;
    }
    const userData = object.userData as {
      polishGroup?: boolean;
      polishPriority?: number;
      polishKind?: string;
    };
    if (userData.polishGroup === true) {
      found.push({
        group: object,
        priority: userData.polishPriority ?? POLISH_PRIORITIES.glows,
        kind: userData.polishKind ?? 'detail',
      });
    }
  });
  return found;
}

/** Result of a draw-call enforcement pass. */
export interface BudgetEnforcement {
  /** Draw calls before any group was hidden. */
  readonly before: number;
  /** Draw calls after enforcement. */
  readonly after: number;
  readonly budget: number;
  /** True when the stage still exceeds the budget after hiding every polish group. */
  readonly overBudget: boolean;
  /** Names of polish groups hidden to bring the stage under budget. */
  readonly hiddenGroups: readonly string[];
}

/**
 * Enforce the draw-call budget on a stage: hide the lowest-priority polish
 * groups (wear -> props -> glows) until `countSceneDrawCalls(root) <= budget`.
 * Producer content is never touched — only polish-layer groups.
 */
export function enforceDrawCallBudget(
  root: THREE.Object3D,
  budget: number = DEFAULT_DRAW_CALL_BUDGET,
): BudgetEnforcement {
  const before = countSceneDrawCalls(root);
  const groups = collectPolishGroups(root).sort((a, b) => a.priority - b.priority);
  const hiddenGroups: string[] = [];
  let draws = before;
  for (const info of groups) {
    if (draws <= budget) {
      break;
    }
    if (!info.group.visible) {
      continue;
    }
    info.group.visible = false;
    hiddenGroups.push(info.group.name || info.kind);
    draws = countSceneDrawCalls(root);
  }
  return {
    before,
    after: draws,
    budget,
    overBudget: draws > budget,
    hiddenGroups,
  };
}

// ============================================================================
// Frame pacing meter
// ============================================================================

/** Frame-pacing readings produced by {@link PerfMeter}. */
export interface PerfReading {
  /** Exponential-smoothed FPS (representative of the current moment). */
  readonly fps: number;
  /** Worst FPS observed since the last reset. */
  readonly minFps: number;
  /** Number of recorded frames. */
  readonly frameCount: number;
}

/** Smoothed + worst-case FPS tracker fed by engine frame deltas. */
export class PerfMeter {
  private frames = 0;
  private minFps = Infinity;
  private smoothedFps = 60;

  /** Record one frame's delta (seconds). Non-finite/zero deltas are ignored. */
  record(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }
    const fps = 1 / deltaSeconds;
    this.frames += 1;
    this.minFps = Math.min(this.minFps, fps);
    this.smoothedFps += (fps - this.smoothedFps) * 0.1;
  }

  /** Reset all accumulated readings. */
  reset(): void {
    this.frames = 0;
    this.minFps = Infinity;
    this.smoothedFps = 60;
  }

  get reading(): PerfReading {
    return {
      fps: this.frames === 0 ? 0 : this.smoothedFps,
      minFps: Number.isFinite(this.minFps) ? this.minFps : 0,
      frameCount: this.frames,
    };
  }

  get frameCount(): number {
    return this.frames;
  }
}

// ============================================================================
// Perf overlay (bottom-left; never overlaps the top timeline HUD)
// ============================================================================

/** Minimal engine surface the overlay reads (SceneEngine satisfies it). */
export interface PerfOverlayEngine {
  /** Register a per-fixed-step callback; returns an unsubscribe function. */
  onFrame(callback: (deltaSeconds: number) => void): () => void;
  /** Current output size in CSS pixels. */
  getSize(): { readonly width: number; readonly height: number };
}

/** Options for {@link createPerfOverlay}. */
export interface PerfOverlayOptions {
  /** DOM mount (defaults to `document.body`). */
  readonly container?: HTMLElement | null;
  readonly engine: PerfOverlayEngine;
  /** The visible stage (attached era scene roots) to budget. */
  readonly stage: THREE.Object3D;
  /** Human-readable current-era label. */
  readonly getEra: () => string;
  /** Stage draw-call ceiling (defaults to `DEFAULT_DRAW_CALL_BUDGET`). */
  readonly budget?: number;
  /** Additive polish-layer ceiling (defaults to `POLISH_DRAW_CALL_BUDGET`). */
  readonly polishBudget?: number;
  readonly maxPixelRatio?: number;
}

/** The live perf HUD handle. */
export interface PerfOverlay {
  /** The mounted panel element (null until `attach`). */
  readonly element: HTMLElement | null;
  /** Create the panel and subscribe to engine frames. */
  attach(): void;
  /** Redraw the readings immediately (also runs budget enforcement). */
  update(): void;
  /** Unsubscribe and remove the panel. */
  detach(): void;
  /** Detach and release internal state. Idempotent. */
  dispose(): void;
  /** Latest frame-pacing readings. */
  readonly meter: PerfMeter;
}

/** How often (in frames) the overlay refreshes its DOM text. */
const OVERLAY_REFRESH_EVERY_FRAMES = 12;

function setPanelLine(panel: HTMLElement, label: string, value: string): void {
  const row = panel.querySelector<HTMLElement>(`[data-perf-line="${label}"]`);
  if (row != null) {
    row.textContent = value;
  }
}

/**
 * Create the performance overlay. Attach mounts a small translucent panel in
 * the bottom-left corner (`z-index: 900`, below the HUD bar's 1000), so it
 * never obscures the top timeline slider; `?perf=1` enables it in the browser.
 */
export function createPerfOverlay(options: PerfOverlayOptions): PerfOverlay {
  const budget = options.budget ?? DEFAULT_DRAW_CALL_BUDGET;
  const polishBudget = options.polishBudget ?? POLISH_DRAW_CALL_BUDGET;
  const maxRatio = options.maxPixelRatio ?? MAX_PIXEL_RATIO;
  const meter = new PerfMeter();

  let element: HTMLElement | null = null;
  let unsubscribeFrame: (() => void) | null = null;
  let frameCounter = 0;
  let disposed = false;

  function buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.dataset.polishPerf = 'overlay';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-label', 'Performance overlay');
    panel.style.cssText = [
      'position:fixed',
      'left:12px',
      'bottom:12px',
      'z-index:900',
      'padding:8px 12px',
      'border-radius:10px',
      'background:rgba(9,11,18,0.74)',
      'border:1px solid rgba(255,255,255,0.16)',
      'color:#dbe4f0',
      'font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      'pointer-events:none',
      'user-select:none',
      'min-width:190px',
      'backdrop-filter:blur(6px)',
      'box-shadow:0 8px 22px rgba(0,0,0,0.4)',
    ].join(';');

    for (const [label, text] of [
      ['fps', 'FPS --'],
      ['pixel', 'pixelRatio --'],
      ['draws', 'draws --'],
      ['polish', 'polish --'],
      ['era', 'era --'],
    ] as const) {
      const line = document.createElement('div');
      line.dataset.perfLine = label;
      line.textContent = text;
      panel.append(line);
    }
    return panel;
  }

  function update(): void {
    if (element === null || disposed) {
      return;
    }
    const reading = meter.reading;
    const deviceRatio = projectDevicePixelRatio();
    const ratio = capPixelRatio(deviceRatio, maxRatio);
    const enforcement = enforceDrawCallBudget(options.stage, budget);
    const polishDraws = countPolishDrawCalls(options.stage);
    const polishOver = polishDraws > polishBudget;

    setPanelLine(element, 'fps', `FPS ${reading.fps.toFixed(1)} (min ${reading.minFps.toFixed(1)})`);
    setPanelLine(element, 'pixel', `pixelRatio ${ratio.toFixed(2)} (dpr ${deviceRatio.toFixed(2)}, cap ${maxRatio})`);
    setPanelLine(element, 'draws', `draws ${enforcement.after}/${budget}${enforcement.overBudget ? ' OVER' : ''}${enforcement.hiddenGroups.length > 0 ? ` (-${enforcement.hiddenGroups.length} polish)` : ''}`);
    setPanelLine(element, 'polish', `polish ${polishDraws}/${polishBudget}${polishOver ? ' OVER' : ''}`);
    setPanelLine(element, 'era', `era ${options.getEra()}`);
  }

  const frameHandler = (deltaSeconds: number): void => {
    meter.record(deltaSeconds);
    frameCounter += 1;
    if (frameCounter % OVERLAY_REFRESH_EVERY_FRAMES === 0) {
      update();
    }
  };

  return {
    get element(): HTMLElement | null {
      return element;
    },
    get meter() {
      return meter;
    },
    attach(): void {
      if (disposed || element !== null) {
        return;
      }
      element = buildPanel();
      const container = options.container ?? (typeof document !== 'undefined' ? document.body : null);
      if (container != null) {
        container.append(element);
      }
      unsubscribeFrame = options.engine.onFrame(frameHandler);
      update();
    },
    update,
    detach(): void {
      unsubscribeFrame?.();
      unsubscribeFrame = null;
      element?.remove();
      element = null;
      frameCounter = 0;
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      this.detach();
      meter.reset();
    },
  };
}