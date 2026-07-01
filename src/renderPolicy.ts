/**
 * Centralized render policy for the city timelapse scene.
 *
 * Z-fighting is a pervasive problem when decals (lane markings, crosswalks),
 * ground planes (roads, sidewalks), and standing props (billboards, lamp posts,
 * pedestrians, vehicles) all share nearly identical depths. Instead of leaving
 * each factory to pick ad-hoc `renderOrder` / `polygonOffset` / `depthWrite`
 * values, every mesh runs through {@link applyRenderPolicy} so there is exactly
 * one source of truth.
 *
 * The function only mutates the supplied {@link THREE.Object3D} and the
 * materials it already owns — it never touches the scene graph, the renderer,
 * or the camera.
 */

import type { Material, Mesh, Object3D } from 'three';

/** Render kinds understood by the city scene. */
export type RenderPolicyKind =
  | 'road'
  | 'marking'
  | 'billboard'
  | 'prop'
  | 'pedestrian'
  | 'vehicle';

/**
 * Immutable depth/render description for a single kind.
 *
 * `polygonOffset` is expressed as `[factor, units]` and may be `null` to keep
 * polygon offset disabled for opaque, well-separated geometry.
 */
export interface RenderPolicy {
  /** Lower numbers draw first. Sorts overlapping geometry deterministically. */
 readonly renderOrder: number;
  /** `[factor, units]` passed to `polygonOffsetFactor`/`polygonOffsetUnits`, or `null` to disable. */
 readonly polygonOffset: readonly [factor: number, units: number] | null;
  /** Whether the fragment writes to the depth buffer. */
 readonly depthWrite: boolean;
  /** Whether the fragment is tested against the depth buffer. */
 readonly depthTest: boolean;
}

/**
 * Canonical policies per kind.
 *
 * Ordering rationale (ascending `renderOrder` ⇒ painted first ⇒ sits "beneath"):
 *  - `road`        : opaque ground, no offset, writes depth.       (order 0)
 *  - `marking`     : thin decals over the road surface, pushed back. (order 1)
 *  - `prop`        : opaque standing geometry (lamp posts, benches). (order 2)
 *  - `pedestrian`  : opaque rigs, always above decals.              (order 3)
 *  - `vehicle`     : opaque rigs, always above decals.              (order 4)
 *  - `billboard`   : often emissive/transparent faces; keep depth on so it
 *                    still occludes correctly but draw last.         (order 5)
 */
export const RENDER_POLICIES: Readonly<Record<RenderPolicyKind, RenderPolicy>> =
  Object.freeze({
    road: Object.freeze({
      renderOrder: 0,
      polygonOffset: null,
      depthWrite: true,
      depthTest: true,
    }),
    marking: Object.freeze({
      renderOrder: 1,
      polygonOffset: [-1, -1] as const,
      depthWrite: true,
      depthTest: true,
    }),
    prop: Object.freeze({
      renderOrder: 2,
      polygonOffset: [-2, -2] as const,
      depthWrite: true,
      depthTest: true,
    }),
    pedestrian: Object.freeze({
      renderOrder: 3,
      polygonOffset: [-2, -2] as const,
      depthWrite: true,
      depthTest: true,
    }),
    vehicle: Object.freeze({
      renderOrder: 4,
      polygonOffset: [-2, -2] as const,
      depthWrite: true,
      depthTest: true,
    }),
    billboard: Object.freeze({
      renderOrder: 5,
      polygonOffset: [-3, -3] as const,
      depthWrite: true,
      depthTest: true,
    }),
  });

/**
 * Resolve the canonical {@link RenderPolicy} for a kind. Exposed so callers can
 * read the intended values (e.g. data-only builders) without owning a mesh.
 */
export function getRenderPolicy(kind: RenderPolicyKind): RenderPolicy {
  const policy = RENDER_POLICIES[kind];
  // Defensive: the record is frozen and exhaustive, but guard against future edits.
  if (!policy) {
    throw new Error(`[renderPolicy] Unknown render policy kind: "${kind}"`);
  }
  return policy;
}

/**
 * Apply a material's depth/offset settings in one place. Mutates only the
 * supplied material — never the scene.
 */
function applyToMaterial(material: Material, policy: RenderPolicy): void {
  material.depthTest = policy.depthTest;
  material.depthWrite = policy.depthWrite;

  if (policy.polygonOffset) {
    const [factor, units] = policy.polygonOffset;
    material.polygonOffset = true;
    material.polygonOffsetFactor = factor;
    material.polygonOffsetUnits = units;
  } else {
    material.polygonOffset = false;
    // Reset factors so a previously-offset material reused under a new policy
    // does not retain stale offset values.
    material.polygonOffsetFactor = 0;
    material.polygonOffsetUnits = 0;
  }

  material.needsUpdate = true;
}

/**
 * Collect every material reachable from an object (including nested children
 * and array materials), deduplicated by reference so each is configured once.
 */
function collectMaterials(root: Object3D): Material[] {
  const materials: Material[] = [];
  const seen = new Set<Material>();

  root.traverse((node) => {
    const mesh = node as Mesh;
    const meshMaterial = mesh.material;
    if (!meshMaterial) return;

    const list = Array.isArray(meshMaterial) ? meshMaterial : [meshMaterial];
    for (const material of list) {
      if (material && !seen.has(material)) {
        seen.add(material);
        materials.push(material);
      }
    }
  });

  return materials;
}

/**
 * Apply the centralized anti-z-fighting policy to a mesh (or any object whose
 * subtree contains meshes).
 *
 * Sets, deterministically per {@link RenderPolicyKind}:
 *  - `object.renderOrder` (and propagated to child meshes so decals layered on
 *    a group still sort correctly),
 *  - `material.polygonOffset` / `polygonOffsetFactor` / `polygonOffsetUnits`,
 *  - `material.depthWrite` and `material.depthTest`.
 *
 * @param mesh The mesh, group, or rig to configure. Only this object and the
 *   materials it already references are mutated.
 * @param kind One of the canonical {@link RenderPolicyKind} values.
 * @returns The same `mesh` reference, for chaining.
 */
export function applyRenderPolicy<T extends Object3D>(
  mesh: T,
  kind: RenderPolicyKind,
): T {
  const policy = getRenderPolicy(kind);

  // Assign the render order on the supplied object first (callers often pass a
  // group whose own order matters for sibling sorting), then mirror it onto
  // every child mesh so decals layered inside a group sort consistently.
  mesh.renderOrder = policy.renderOrder;
  mesh.traverse((node) => {
    node.renderOrder = policy.renderOrder;
  });

  for (const material of collectMaterials(mesh)) {
    applyToMaterial(material, policy);
  }

  return mesh;
}
