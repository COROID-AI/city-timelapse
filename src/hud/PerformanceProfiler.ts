/**
 * PerformanceProfiler — measures FPS and draw-call/triangle counts via
 * `renderer.info`, and enforces agent-population + instancing caps.
 *
 * The profiler is a lightweight overlay that samples `renderer.info` every
 * frame and rolls a sliding-window average of FPS. It surfaces:
 *   - FPS (rolling average, 1s window)
 *   - Draw calls (`info.render.calls`)
 *   - Triangles (`info.render.triangles`)
 *   - Textures / programs (for diagnosing material/state overhead)
 *
 * The HUD shows the current FPS with a color-coded badge (green ≥55, amber
 * 30–54, red <30) so the performance gate is visually verifiable at a glance.
 *
 * Agent caps are enforced by a central registry: each agent system registers
 * its population ceiling via `registerAgentCap()`. The profiler records the
 * intended caps (so they are documented and queryable), and the agent systems
 * themselves honor the caps at spawn time. This keeps the caps in one place
 * and makes the performance budget auditable.
 */

import type { WebGLRenderer } from 'three';

/** FPS target thresholds for the performance gate. */
export const FPS_FLOOR = 30;
export const FPS_TARGET = 60;

/** Sliding-window size for the rolling FPS average (≈1 second at 60 FPS). */
const FPS_SAMPLE_WINDOW = 60;

/** How often (ms) to refresh the on-screen HUD readout. */
const HUD_REFRESH_MS = 250;

/** Color thresholds for the FPS badge. */
function fpsColor(fps: number): string {
  if (fps >= 55) return '#5fff8f'; // green — comfortably at/above target
  if (fps >= FPS_FLOOR) return '#ffb347'; // amber — above floor
  return '#ff5555'; // red — below floor
}

/** A registered population cap for an agent category. */
export interface AgentCap {
  /** Human-readable label, e.g. "Vehicles". */
  label: string;
  /** Maximum concurrent instances. */
  max: number;
}

export interface PerformanceProfilerOptions {
  /** Whether to create and mount the HUD overlay. Defaults to true. */
  createHud?: boolean;
}

export interface PerformanceProfiler {
  /** Advance the profiler one frame. Call from the render loop with delta in ms. */
  update: (deltaMs: number) => void;
  /** Register a population cap for an agent category (for auditing/display). */
  registerAgentCap: (name: string, cap: AgentCap) => void;
  /** Current rolling-average FPS. */
  getFps: () => number;
  /** Latest draw-call count from `renderer.info`. */
  getDrawCalls: () => number;
  /** Latest triangle count from `renderer.info`. */
  getTriangles: () => number;
  /** Snapshot of all registered agent caps. */
  getAgentCaps: () => Record<string, AgentCap>;
  /** Whether the current FPS meets the performance floor (>=30). */
  meetsFloor: () => boolean;
  /** Release the HUD element and stop profiling. */
  dispose: () => void;
}

/**
 * Create a performance profiler bound to a Three.js renderer.
 *
 * The profiler reads `renderer.info` (reset each frame by the renderer) after
 * `composer.render()` / `renderer.render()` is called. For correctness, call
 * `profiler.update(deltaMs)` at the end of the render loop — after the render
 * call — so `info` reflects the just-completed frame.
 */
export function createPerformanceProfiler(
  renderer: WebGLRenderer,
  options: PerformanceProfilerOptions = {},
): PerformanceProfiler {
  const createHud = options.createHud ?? true;

  // --- FPS rolling average ---
  const fpsSamples: number[] = [];
  let fps = 0;
  let drawCalls = 0;
  let triangles = 0;

  // --- Agent cap registry ---
  const agentCaps: Record<string, AgentCap> = {};

  // --- HUD ---
  let hudEl: HTMLDivElement | null = null;
  let fpsEl: HTMLSpanElement | null = null;
  let drawCallsEl: HTMLSpanElement | null = null;
  let trisEl: HTMLSpanElement | null = null;
  let capsEl: HTMLSpanElement | null = null;

  if (createHud) {
    hudEl = document.createElement('div');
    hudEl.className = 'perf-hud';

    fpsEl = document.createElement('span');
    fpsEl.className = 'perf-hud__fps';

    drawCallsEl = document.createElement('span');
    drawCallsEl.className = 'perf-hud__stat';

    trisEl = document.createElement('span');
    trisEl.className = 'perf-hud__stat';

    capsEl = document.createElement('span');
    capsEl.className = 'perf-hud__stat perf-hud__caps';

    hudEl.append(fpsEl, drawCallsEl, trisEl, capsEl);
  }

  let hudAccumulator = 0;

  function pushSample(deltaMs: number): void {
    if (deltaMs <= 0) return;
    const instantFps = 1000 / deltaMs;
    fpsSamples.push(instantFps);
    if (fpsSamples.length > FPS_SAMPLE_WINDOW) {
      fpsSamples.shift();
    }
    let sum = 0;
    for (const s of fpsSamples) sum += s;
    fps = sum / fpsSamples.length;
  }

  function readRendererInfo(): void {
    const info = renderer.info;
    drawCalls = info.render.calls;
    triangles = info.render.triangles;
  }

  function updateHud(): void {
    if (!fpsEl || !drawCallsEl || !trisEl || !capsEl) return;
    fpsEl.textContent = `${fps.toFixed(0)} FPS`;
    fpsEl.style.color = fpsColor(fps);
    drawCallsEl.textContent = `${drawCalls} calls`;
    trisEl.textContent = formatTriangles(triangles);
    const capParts: string[] = [];
    for (const [, cap] of Object.entries(agentCaps)) {
      capParts.push(`${cap.label}: ${cap.max}`);
    }
    capsEl.textContent = capParts.join(' · ');
  }

  function formatTriangles(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M tris`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K tris`;
    return `${n} tris`;
  }

  function update(deltaMs: number): void {
    readRendererInfo();
    pushSample(deltaMs);
    hudAccumulator += deltaMs;
    if (hudAccumulator >= HUD_REFRESH_MS) {
      hudAccumulator = 0;
      updateHud();
    }
  }

  function registerAgentCap(name: string, cap: AgentCap): void {
    agentCaps[name] = cap;
  }

  function getFps(): number {
    return fps;
  }

  function getDrawCalls(): number {
    return drawCalls;
  }

  function getTriangles(): number {
    return triangles;
  }

  function getAgentCaps(): Record<string, AgentCap> {
    return agentCaps;
  }

  function meetsFloor(): boolean {
    return fps >= FPS_FLOOR;
  }

  function dispose(): void {
    if (hudEl && hudEl.parentElement) {
      hudEl.parentElement.removeChild(hudEl);
    }
    hudEl = null;
  }

  return {
    update,
    registerAgentCap,
    getFps,
    getDrawCalls,
    getTriangles,
    getAgentCaps,
    meetsFloor,
    dispose,
    // Expose the HUD element so the caller can mount it where desired.
    ...(hudEl ? { hudElement: hudEl } : {}),
  } as PerformanceProfiler & { hudElement?: HTMLDivElement };
}

/**
 * Per-era agent population caps.
 *
 * These are the *intended* steady-state populations per era. The agent systems
 * honor a global hard cap (enforced in their constructors) that accommodates
 * two concurrent populations during a cross-fade. These values document the
 * performance budget and are surfaced in the profiler HUD.
 */
export const ERA_AGENT_CAPS: Record<string, { label: string; max: number }> = {
  vehicles: { label: 'Vehicles', max: 6 },
  pedestrians: { label: 'Peds', max: 12 },
  cyclists: { label: 'Bikes', max: 5 },
  dogs: { label: 'Dogs', max: 3 },
};
