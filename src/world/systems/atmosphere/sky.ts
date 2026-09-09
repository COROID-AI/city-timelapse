/**
 * Era-driven sky system for the city block.
 *
 * Builds one low-poly gradient dome (a `Mesh` whose geometry carries a
 * per-vertex `color` attribute — the same convention used by GridHelper and
 * PolarGridHelper in this Three.js line) plus the directional key-light state.
 * The dome's vertex colors are recomputed live from the interpolated era sky
 * gradient, and the sun/key-light data (color, intensity, normalized
 * direction) is exposed for the compose-scene-app renderer to drive
 * directional shadows and ACES-friendly exposure/tonemapping.
 *
 * Colors are stored per-vertex as 0..1 floats; the material color stays white
 * so the gradient is pristine.
 */

import {
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  type Object3D,
} from 'three';
import type { EraSystem, TimelineChannel } from '../../../era/types';

import { atmosphereEraData } from './atmosphereEraData';
import { interpolateEraAtmosphere, toThreeColor } from './interpolation';

/** World units of the dome radius. */
export const SKY_DOME_RADIUS = 90;

/** Vertex resolution of the gradient dome (kept low: 32 around x 12 bands). */
export const SKY_LATITUDE_SEGMENTS = 32;
export const SKY_HEIGHT_SEGMENTS = 12;

export interface SkyResources {
  /** The gradient sky dome mesh (child of the sky group). */
  readonly dome: Mesh;
  /** Dome material (white; the gradient lives in per-vertex colors). */
  readonly domeMaterial: MeshBasicMaterial;
}

export interface SunState {
  /** Sun / key light color (0xRRGGBB, renderer/ACES ready). */
  readonly color: number;
  /** Sun light intensity. */
  readonly intensity: number;
  /** Normalized sun direction [x, y, z] (y > 0 = above horizon). */
  readonly direction: [number, number, number];
}

export interface SkyEraSystem extends EraSystem<{ scene: Object3D | undefined }> {
  /** Sun/key-light state for the current frame. */
  readonly sun: SunState;
  /** Whether the sky dome is currently visible. */
  readonly visible: boolean;
  /** The sky group (child of the scene) once attached. */
  readonly group: Group | null;
  /** Contained disposable resources once attached. */
  readonly skyResources: SkyResources | null;
  /** Toggle sky visibility. */
  show(show: boolean): void;
}

interface DomeColorRun {
  gradient: { zenith: string; horizon: string; ground: string };
  keyColor: number;
}

/** Normalize a direction vector; falls back to up when degenerate. */
function normalizeInPlace(vec: [number, number, number]): [number, number, number] {
  const len = Math.hypot(vec[0], vec[1], vec[2]);
  if (len < 1e-6) return [0, 1, 0];
  return [vec[0] / len, vec[1] / len, vec[2] / len];
}

/** Blend two hex colors at t into a three.js Color (0..1 channels). */
function lerpHexColors(a: string, b: string, t: number): Color {
  const c = toThreeColor(a);
  c.lerp(toThreeColor(b), Math.max(0, Math.min(1, t)));
  return c;
}

/**
 * (Re)paint the dome's per-vertex color attribute from the era sky gradient:
 * zenith at the top, horizon at the equator, ground-tone bias below. Reads
 * the vertex height from the shared `position` attribute, writes into the
 * `color` attribute, then marks it dirty for the renderer.
 */
function paintSkyVertexColors(dome: Mesh, run: DomeColorRun): void {
  const geometry = dome.geometry;
  const positionAttr = geometry.getAttribute('position');
  const colorAttr = geometry.getAttribute('color');
  if (!positionAttr || !colorAttr) return;

  const count = colorAttr.count;
  for (let i = 0; i < count; i += 1) {
    const ny = Math.max(-1, Math.min(1, positionAttr.getY(i) / SKY_DOME_RADIUS));
    let top: string;
    let bottom: string;
    if (ny >= 0) {
      top = run.gradient.zenith;
      bottom = run.gradient.horizon;
    } else {
      top = run.gradient.horizon;
      bottom = run.gradient.ground;
    }
    // u in [0,1] from pole (zenith) to equator (horizon) to base (ground).
    const u = Math.acos(Math.max(-1, Math.min(1, ny))) / (Math.PI / 2);
    const rgb = lerpHexColors(top, bottom, u);
    colorAttr.setXYZ(i, rgb.r, rgb.g, rgb.b);
  }
  colorAttr.needsUpdate = true;
}

/** Build the dome mesh: geometry with a per-vertex color attribute. */
function buildSkyDome(initial: DomeColorRun): { dome: Mesh; material: MeshBasicMaterial } {
  const geometry = new SphereGeometry(
    SKY_DOME_RADIUS,
    SKY_LATITUDE_SEGMENTS,
    SKY_HEIGHT_SEGMENTS,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2, // upper dome only
  );

  const vertexCount = (SKY_HEIGHT_SEGMENTS + 1) * (SKY_LATITUDE_SEGMENTS + 1);
  const colorAttribute = new Float32BufferAttribute(new Float32Array(vertexCount * 3), 3);
  geometry.setAttribute('color', colorAttribute);

  const material = new MeshBasicMaterial({ color: 0xffffff });
  const dome = new Mesh(geometry, material);
  dome.name = 'sky-dome';
  paintSkyVertexColors(dome, initial);

  return { dome, material };
}

export function createSkySystem(): SkyEraSystem {
  const initial: DomeColorRun = {
    gradient: { zenith: '#475569', horizon: '#d6d3d1', ground: '#292524' },
    keyColor: 0xfed7aa,
  };

  let group: Group | null = null;
  let resources: SkyResources | null = null;

  let gradient: DomeColorRun = initial;
  let sunIntensity = 0.85;
  let sunPosition: [number, number, number] = normalizeInPlace([-12, 18, 14]);

  let visible = true;
  let disposed = false;

  return {
    get sun(): SunState {
      return {
        color: gradient.keyColor,
        intensity: sunIntensity,
        direction: [...sunPosition],
      };
    },

    get visible() {
      return visible;
    },

    get group() {
      return group;
    },

    get skyResources() {
      return resources;
    },

    attach(context: { scene: Object3D | undefined }): void {
      if (disposed || group) return;
      const built = buildSkyDome(gradient);
      group = new Group();
      group.name = 'atmosphere-sky';
      group.add(built.dome);
      resources = { dome: built.dome, domeMaterial: built.material };
      if (context.scene) {
        context.scene.add(group);
      }
    },

    update(channel: TimelineChannel, _deltaSeconds: number): void {
      if (disposed) return;
      const from = atmosphereEraData[channel.fromEra] ?? atmosphereEraData['1945'];
      const to = atmosphereEraData[channel.toEra] ?? atmosphereEraData['1945'];
      const spec = interpolateEraAtmosphere(from, to, channel.t);

      gradient = {
        gradient: {
          zenith: spec.skyGradient.zenith,
          horizon: spec.skyGradient.horizon,
          ground: spec.skyGradient.ground,
        },
        keyColor: toThreeColor(spec.sunColor).getHex(),
      };
      sunIntensity = spec.sunIntensity;
      sunPosition = normalizeInPlace([
        spec.sunPosition[0],
        spec.sunPosition[1],
        spec.sunPosition[2],
      ]);

      if (resources && visible) {
        paintSkyVertexColors(resources.dome, gradient);
      }
    },

    show(show: boolean): void {
      if (disposed || !group) return;
      visible = show;
      group.visible = show;
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (group?.parent) {
        group.parent.remove(group);
      }
      if (resources) {
        resources.dome.geometry.dispose();
        resources.domeMaterial.dispose();
      }
      group = null;
      resources = null;
    },
  };
}
