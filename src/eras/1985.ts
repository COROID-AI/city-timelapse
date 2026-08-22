/**
 * Era module for 1985: concrete/glass offices, arcade/video-rental signage, 80s vehicles & fashion
 *
 * Exports buildEra1985() returning a THREE.Group with:
 * - Taller concrete/glass buildings
 * - Video-rental/arcade storefront with glowing signage
 * - Graffiti accents
 * - 1980s boxy sedans and delivery van
 * - Pedestrians in 80s fashion
 * - Large billboards with 80s typography
 * - Sodium-vapor streetlights
 * - Subway entrance or bus stop
 *
 * All geometry created via three.js primitives
 */

import * as THREE from 'three';

/**
 * Animation handles and the per-instance clock kept on the built group at
 * `group.userData.animatedObjects`, so `update(dt, group)` needs no module-
 * scoped or window-global state and separately built instances animate
 * independently.
 */
export interface Era1985AnimatedObjects {
  /** Accumulated animation seconds for this specific group instance. */
  elapsed: number;
  /** Boxy 80s sedan cruising along the street. */
  readonly sedan1: THREE.Mesh;
  /** Delivery van on its route. */
  readonly van: THREE.Mesh;
  /** Pedestrian walking the sidewalk. */
  readonly pedestrian1: THREE.Mesh;
}

export function buildEra1985(): THREE.Group {
  const eraGroup = new THREE.Group();

  // Buildings
  const build1 = new THREE.Mesh(
    new THREE.BoxGeometry(12, 25, 8),
    new THREE.MeshStandardMaterial({ color: 0x808080, metalness: 0.2 })
  ); // Concrete
  build1.position.set(-20, 15, 0);
  eraGroup.add(build1);

  const build2 = new THREE.Mesh(
    new THREE.BoxGeometry(10, 20, 6),
    new THREE.MeshStandardMaterial({ color: 0x404040, metalness: 0.5 })
  ); // Glass accents
  build2.position.set(5, 12, 0);
  eraGroup.add(build2);

  // Storefront with glowing signage
  const storefront = new THREE.Mesh(
    new THREE.BoxGeometry(8, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ffff, emissiveIntensity: 1.5 })
  ); // Neon sign
  storefront.position.set(0, 8, 0);
  eraGroup.add(storefront);

  // Graffiti accents
  const graffiti1 = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 3),
    new THREE.MeshBasicMaterial({ color: 0x336699 })
  ); // Graffiti wall
  graffiti1.position.set(-10, 10, 5);
  eraGroup.add(graffiti1);

  // Vehicles
  const sedan1 = new THREE.Mesh(
    new THREE.BoxGeometry(5, 2.5, 3),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  ); // 80s sedan
  sedan1.position.set(10, 1.5, 5);
  eraGroup.add(sedan1);

  const van = new THREE.Mesh(
    new THREE.BoxGeometry(6, 3, 4),
    new THREE.MeshStandardMaterial({ color: 0x00ffff })
  ); // Delivery van
  van.position.set(15, 1.5, 10);
  eraGroup.add(van);

  // Pedestrians
  const pedestrian1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2, 16),
    new THREE.MeshStandardMaterial({ color: 0xff00ff })
  ); // 80s fashion silhouette
  pedestrian1.position.set(-5, 1.5, 5);
  eraGroup.add(pedestrian1);

  // Billboards
  const billboard = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 4),
    new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.8 })
  ); // 80s ad
  billboard.position.set(5, 9, 0);
  eraGroup.add(billboard);

  // Street furniture
  const lamppost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 12, 32),
    new THREE.MeshStandardMaterial({ color: 0xffaa00 })
  ); // Sodium-vapor lamp
  lamppost.position.set(0, 0, 15);
  eraGroup.add(lamppost);

  // Subway entrance
  const subwayEntrance = new THREE.Mesh(
    new THREE.BoxGeometry(3, 6, 3),
    new THREE.MeshStandardMaterial({ color: 0x555555 })
  ); // Subway entrance structure
  subwayEntrance.position.set(-25, 3, 0);
  eraGroup.add(subwayEntrance);

  // Store per-instance animation state (meshes + clock) for update().
  const animatedObjects: Era1985AnimatedObjects = {
    elapsed: 0,
    sedan1,
    van,
    pedestrian1,
  };
  eraGroup.userData.animatedObjects = animatedObjects;

  return eraGroup;
}

/**
 * Update tick for animating vehicles and pedestrians.
 *
 * Follows the shared era-module contract (`update(dt, group)`): every piece of
 * mutable state lives on the passed group — mesh handles and the elapsed-time
 * clock come from `group.userData.animatedObjects` — so instances stay
 * independent and no module-level accumulator is involved.
 *
 * @param dt Time delta in seconds; non-finite/non-positive values are ignored
 * @param group Group previously returned by {@link buildEra1985}
 */
export function update(dt: number, group: THREE.Group): void {
  const animated = group.userData.animatedObjects as Era1985AnimatedObjects | undefined;
  if (!animated) return;

  const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.05) : 0;
  if (step <= 0) return;

  animated.elapsed += step;
  const t = animated.elapsed;

  // Vehicle motion - sedan drives back and forth
  animated.sedan1.position.x = 10 + Math.sin(t * 0.5) * 8;

  // Van delivery route
  animated.van.position.x = 15 + Math.sin(t * 0.3) * 5;

  // Pedestrian walking cycle
  animated.pedestrian1.position.x = -5 + Math.sin(t * 1.2) * 2;
}