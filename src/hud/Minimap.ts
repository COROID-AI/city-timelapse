/**
 * Minimap — an optional top-down radar overlay showing the block, roads, and
 * active agents.
 *
 * Renders a small 2D canvas in the HUD corner. The block footprint, building
 * lots, and road network are drawn once (static geometry). Active agents
 * (vehicles, pedestrians, cyclists, dogs) are polled from their system groups
 * every few frames and plotted as colored dots — vehicles in amber, pedestrians
 * in cyan, cyclists in green, dogs in warm white.
 *
 * The minimap is intentionally lightweight: it reads world XZ positions from
 * the agent groups' children and projects them onto the 2D canvas. No Three.js
 * raycasting or off-screen render targets are used, keeping the overhead
 * negligible even with the full agent population.
 */

import { BLOCK_HALF, BLOCK_SIZE } from '../constants.js';
import type { RoadNetwork } from '../world/roadNetwork.js';
import { Group, InstancedMesh, Matrix4 } from 'three';

/** Logical world extent the minimap covers (a margin around the block). */
const MAP_MARGIN = 12;
const MAP_HALF = BLOCK_HALF + MAP_MARGIN;

/** Physical canvas pixel size (rendered at 2× for crispness). */
const CANVAS_CSS_SIZE = 148;
const DPR = 2;

/** How often (in ms) to refresh agent positions on the minimap. */
const REFRESH_INTERVAL_MS = 120;

/** Agent dot colors. */
const COLORS = {
  background: 'rgba(8, 12, 20, 0.72)',
  block: 'rgba(120, 130, 150, 0.30)',
  lot: 'rgba(90, 100, 120, 0.55)',
  road: 'rgba(50, 55, 68, 0.85)',
  intersection: 'rgba(56, 225, 255, 0.35)',
  vehicle: '#ffb347',
  pedestrian: '#38e1ff',
  cyclist: '#5fff8f',
  dog: '#f0e8d0',
};

export interface MinimapAgentSources {
  /** Group containing vehicle meshes (optional — shown if present). */
  vehicles?: Group;
  /** Group containing pedestrian meshes. */
  pedestrians?: Group;
  /** Group containing cyclist instanced meshes. */
  cyclists?: Group;
  /** Group containing dog meshes. */
  dogs?: Group;
}

export interface MinimapOptions {
  /** CSS size of the square minimap in pixels. Defaults to 148. */
  size?: number;
}

export interface Minimap {
  /** The canvas element to mount in the HUD. */
  canvas: HTMLCanvasElement;
  /** Advance the minimap (poll agents + redraw). Call from the render loop. */
  update: (deltaMs: number) => void;
  /** Release the canvas and stop drawing. */
  dispose: () => void;
}

/**
 * Create a minimap bound to the road network and agent groups.
 *
 * The static layer (block + roads) is drawn once. Agent positions are polled
 * from the group children at a throttled interval and replotted.
 */
export function createMinimap(
  network: RoadNetwork,
  sources: MinimapAgentSources,
  options: MinimapOptions = {},
): Minimap {
  const cssSize = options.size ?? CANVAS_CSS_SIZE;

  const canvas = document.createElement('canvas');
  canvas.className = 'minimap';
  canvas.width = cssSize * DPR;
  canvas.height = cssSize * DPR;
  canvas.style.width = `${cssSize}px`;
  canvas.style.height = `${cssSize}px`;
  canvas.setAttribute('aria-label', 'Block minimap showing roads and active agents');

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Minimap: unable to acquire 2D canvas context');
  }
  ctx.scale(DPR, DPR);

  // --- Coordinate mapping: world XZ → canvas pixels -----------------------
  // World X maps to canvas X, world Z maps to canvas Y. The block is centered
  // at origin; we map [-MAP_HALF, MAP_HALF] → [0, cssSize].
  const scale = cssSize / (MAP_HALF * 2);
  const cx = cssSize / 2;
  const cy = cssSize / 2;
  const wx2px = (wx: number): number => cx + wx * scale;
  const wz2py = (wz: number): number => cy + wz * scale;

  /** Half-width of the asphalt surface (matches BlockLayout ASPHALT_HALF). */
  const ASPHALT_HALF_WORLD = 8.5;

  // --- Draw the static layer (block + roads + lots) -----------------------
  const drawStatic = (): void => {
    ctx.clearRect(0, 0, cssSize, cssSize);

    // Panel background.
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, cssSize, cssSize);

    // Block footprint (the buildable perimeter).
    const bx = wx2px(-BLOCK_HALF);
    const by = wz2py(-BLOCK_HALF);
    const bs = BLOCK_SIZE * scale;
    ctx.fillStyle = COLORS.block;
    ctx.fillRect(bx, by, bs, bs);

    // Road segments: draw driving-lane edges as thin lines.
    ctx.strokeStyle = COLORS.road;
    ctx.lineWidth = Math.max(2, ASPHALT_HALF_WORLD * scale);
    ctx.lineCap = 'round';
    for (const edge of network.edges) {
      if (edge.laneType !== 'driving') continue;
      const from = network.nodes.find((n) => n.id === edge.from);
      const to = network.nodes.find((n) => n.id === edge.to);
      if (!from || !to) continue;
      ctx.beginPath();
      ctx.moveTo(wx2px(from.position.x), wz2py(from.position.z));
      ctx.lineTo(wx2px(to.position.x), wz2py(to.position.z));
      ctx.stroke();
    }

    // Building lots as small squares.
    ctx.fillStyle = COLORS.lot;
    for (const lot of network.lots) {
      const lx = wx2px(lot.center.x - lot.width / 2);
      const ly = wz2py(lot.center.z - lot.depth / 2);
      const lw = Math.max(2, lot.width * scale);
      const lh = Math.max(2, lot.depth * scale);
      ctx.fillRect(lx, ly, lw, lh);
    }

    // Intersection center marker.
    for (const inter of network.intersections) {
      ctx.fillStyle = COLORS.intersection;
      ctx.beginPath();
      ctx.arc(wx2px(inter.center.x), wz2py(inter.center.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  drawStatic();

  // --- Agent polling -------------------------------------------------------
  let accumulator = 0;

  /**
   * Plot every child of a group as a dot at its world XZ position.
   * Groups are added at the scene origin so local positions ≈ world positions
   * for these flat agent groups. For InstancedMesh children (cyclists, dogs)
   * we sample each instance matrix to plot individual agent positions.
   */
  const plotGroup = (group: Group | undefined, color: string, radius: number): void => {
    if (!group) return;
    ctx.fillStyle = color;
    const tmp = new Matrix4();
    for (const child of group.children) {
      if (child instanceof InstancedMesh) {
        // Plot each instance from its world matrix translation.
        for (let i = 0; i < child.count; i++) {
          child.getMatrixAt(i, tmp);
          const px = wx2px(tmp.elements[12]);
          const py = wz2py(tmp.elements[14]);
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const px = wx2px(child.position.x);
        const py = wz2py(child.position.z);
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const pollAgents = (): void => {
    drawStatic();
    plotGroup(sources.vehicles, COLORS.vehicle, 2.4);
    plotGroup(sources.cyclists, COLORS.cyclist, 2.0);
    plotGroup(sources.pedestrians, COLORS.pedestrian, 1.8);
    plotGroup(sources.dogs, COLORS.dog, 1.4);
  };

  const update = (deltaMs: number): void => {
    accumulator += deltaMs;
    if (accumulator < REFRESH_INTERVAL_MS) return;
    accumulator = 0;
    pollAgents();
  };

  const dispose = (): void => {
    // Nothing to detach beyond the canvas; the caller owns DOM placement.
  };

  return { canvas, update, dispose };
}
