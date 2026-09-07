import { BoxGeometry, Mesh, MeshStandardMaterial, Scene } from 'three';
import { CityBlockLayout } from '../layout/cityBlockLayout';

/**
 * PlaceholderVehicle: one moving vehicle that follows the road loop around
 * the block. Proves the animation pipeline.
 */
export interface PlaceholderVehicle {
  /** The mesh representing the vehicle. */
  readonly mesh: Mesh;
  /** Advance the vehicle along the loop by dt seconds. */
  update(dt: number): void;
}

interface LoopPoint {
  x: number;
  z: number;
}

export function createPlaceholderVehicle(
  scene: Scene,
  layout: CityBlockLayout,
): PlaceholderVehicle {
  const mesh = new Mesh(new BoxGeometry(2.4, 1.2, 4.6), new MeshStandardMaterial());
  mesh.material.color.setRGB(0.8, 0.2, 0.1);
  scene.add(mesh);

  // Build a rectangular loop from the street ring (their outer edges).
  const pad = 2;
  const minX = layout.bounds.minX + pad;
  const maxX = layout.bounds.maxX - pad;
  const minZ = layout.bounds.minZ + pad;
  const maxZ = layout.bounds.maxZ - pad;

  const loop: LoopPoint[] = [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ];

  const SPEED = 10; // world units per second
  let segment = 0;
  let t = 0; // progress along current segment in [0, 1]

  function segmentLength(seg: number): number {
    const a = loop[seg];
    const b = loop[(seg + 1) % loop.length];
    return Math.hypot(b.x - a.x, b.z - a.z);
  }

  function update(dt: number): void {
    let remaining = SPEED * dt;
    while (remaining > 0) {
      const len = segmentLength(segment);
      const dist = remaining;
      remaining = 0;
      const frac = dist / len;
      if (t + frac >= 1) {
        remaining = (t + frac - 1) * len;
        t = 0;
        segment = (segment + 1) % loop.length;
      } else {
        t += frac;
      }
    }
    const a = loop[segment];
    const b = loop[(segment + 1) % loop.length];
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    mesh.position.set(x, 0.7, z);
    // Face direction of travel.
    const angle = Math.atan2(b.x - a.x, b.z - a.z);
    mesh.rotation.y = angle;
  }

  return { mesh, update };
}