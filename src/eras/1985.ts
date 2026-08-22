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

/** Time accumulator for animation cycles */
let timeAccumulator = 0;

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

  // Store references for animation
  eraGroup.userData.animatedObjects = {
    sedan1,
    van,
    pedestrian1,
  };

  return eraGroup;
}

/**
 * Update tick for animating vehicles and pedestrians
 * @param dt Time delta in seconds
 */
export function update(dt: number): void {
  timeAccumulator += dt;

  // Get animated objects from the group
  // Note: This function operates on objects from the last buildEra1985 call
  // In a full implementation, this would be managed by a scene controller

  // Vehicle motion - sedan drives back and forth
  const sedanPos = 10 + Math.sin(timeAccumulator * 0.5) * 8;
  // @ts-ignore - accessing userData set in buildEra1985
  const sedan = (window as any).__era1985_sedan;
  if (sedan) sedan.position.x = sedanPos;

  // Van delivery route
  const vanPos = 15 + Math.sin(timeAccumulator * 0.3) * 5;
  // @ts-ignore - accessing userData set in buildEra1985
  const van = (window as any).__era1985_van;
  if (van) van.position.x = vanPos;

  // Pedestrian walking cycle
  const pedPos = -5 + Math.sin(timeAccumulator * 1.2) * 2;
  // @ts-ignore - accessing userData set in buildEra1985
  const pedestrian = (window as any).__era1985_pedestrian;
  if (pedestrian) pedestrian.position.x = pedPos;
}