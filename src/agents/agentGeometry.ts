/**
 * Shared parametric-geometry helpers for cyclist & dog agents.
 *
 * Both agent systems build their models from many small primitives (wheels,
 * frame tubes, limbs) baked into a *single* merged {@link BufferGeometry} with
 * per-part vertex colors. That merged geometry is then driven by one
 * {@link InstancedMesh} per era with a single shared material — the lightest
 * possible representation for a capped, instanced agent population, and the one
 * that lets the TransitionManager cross-fade the visible bike/dog model by
 * swapping material opacity without rebuilding the scene graph.
 *
 * This module is Three.js-only geometry plumbing (no era/network logic) so the
 * cyclist and dog systems stay focused on behavior + era identity.
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A primitive plus a baked hex color; {@link mergeColored} consumes these. */
export interface ColoredPart {
  geometry: BufferGeometry;
  color: number;
}

/**
 * Paint every vertex of `geometry` a solid hex `color` by attaching a `color`
 * attribute. Required so {@link mergeColored} can combine parts of differing
 * colors into one vertex-colored mesh. Mutates and returns the geometry.
 */
export function applyVertexColor(geometry: BufferGeometry, color: number): BufferGeometry {
  const count = geometry.attributes.position.count;
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = r;
    arr[i * 3 + 1] = g;
    arr[i * 3 + 2] = b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return geometry;
}

/** Attach a hex color to a part, returning the colored part descriptor. */
export function colored(geometry: BufferGeometry, color: number): ColoredPart {
  return { geometry: applyVertexColor(geometry, color), color };
}

/**
 * Merge several colored primitives into a single vertex-colored geometry.
 *
 * All parts are baked with a `color` attribute (see {@link applyVertexColor});
 * the merged result carries `position`, `normal`, `uv`, and `color`, ready for a
 * `MeshStandardMaterial({ vertexColors: true })`. Returns an empty geometry if
 * no parts are supplied so callers always get a valid mesh.
 */
export function mergeColored(parts: ColoredPart[]): BufferGeometry {
  if (parts.length === 0) {
    return new BufferGeometry();
  }
  const merged = mergeGeometries(parts.map((p) => p.geometry), false);
  return merged ?? new BufferGeometry();
}
