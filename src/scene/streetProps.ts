/**
 * Street props module: lamp posts, fire hydrants, benches, trees and
 * traffic lights. Lamp colors/heights evolve by era (gas → cobra → sodium
 * → LED → holographic); small props add the street-level detail.
 */
import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { EraId, ERA_IDS } from '../eras';
import { colorBlend, colorFromHex, lerp, matColor, Rng } from '../helpers';
import { getPalette } from '../palette';
import { AppState, eraBlend, eraIndexAbove, eraIndexBelow } from '../state';

interface Lamp {
  pole: Mesh;
  poleMaterial: MeshStandardMaterial;
  head: Mesh;
  headMaterial: MeshStandardMaterial;
  glow: Mesh;
  glowMaterial: MeshStandardMaterial;
  x: number;
  z: number;
}

interface Hydrant {
  mesh: Mesh;
  material: MeshStandardMaterial;
  x: number;
  z: number;
}

interface Bench {
  mesh: Mesh;
  material: MeshStandardMaterial;
  x: number;
  z: number;
}

interface Tree {
  trunk: Mesh;
  trunkMaterial: MeshStandardMaterial;
  crown: Mesh;
  crownMaterial: MeshStandardMaterial;
  x: number;
  z: number;
}

interface TrafficLight {
  mesh: Mesh;
  material: MeshStandardMaterial;
  x: number;
  z: number;
}

export class StreetProps {
  readonly group = new Group();
  private readonly lamps: Lamp[] = [];
  private readonly hydrants: Hydrant[] = [];
  private readonly benches: Bench[] = [];
  private readonly trees: Tree[] = [];
  private readonly trafficLights: TrafficLight[] = [];
  private readonly poleGeom: BoxGeometry;
  private readonly headGeom: BoxGeometry;
  private readonly glowGeom: SphereGeometry;
  private readonly hydrantGeom: BoxGeometry;
  private readonly benchGeom: BoxGeometry;
  private readonly trunkGeom: BoxGeometry;
  private readonly crownGeom: SphereGeometry;
  private readonly lightGeom: BoxGeometry;

  constructor() {
    this.poleGeom = new BoxGeometry(0.15, 1, 0.15);
    this.headGeom = new BoxGeometry(0.5, 0.25, 0.4);
    this.glowGeom = new SphereGeometry(0.22, 8, 6);
    this.hydrantGeom = new BoxGeometry(0.4, 0.7, 0.4);
    this.benchGeom = new BoxGeometry(1.4, 0.12, 0.5);
    this.trunkGeom = new BoxGeometry(0.3, 1.6, 0.3);
    this.crownGeom = new SphereGeometry(1.1, 10, 7);
    this.lightGeom = new BoxGeometry(0.3, 0.7, 0.3);

    const rng = new Rng(0x3399);
    // Lamps along both sidewalks.
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -22 + i * 6;
      this.lamps.push(this.createLamp(side * 5.2, z));
    }
    // Hydrants.
    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -18 + i * 10;
      this.hydrants.push(this.createHydrant(side * 4.4, z));
    }
    // Benches.
    for (let i = 0; i < 3; i++) {
      this.benches.push(this.createBench(i % 2 === 0 ? -4.6 : 4.6, -14 + i * 12));
    }
    // Trees.
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -24 + i * 8;
      this.trees.push(this.createTree(side * 6.4, z, rng));
    }
    // Traffic lights.
    for (let i = 0; i < 2; i++) {
      this.trafficLights.push(this.createTrafficLight(i === 0 ? -1 : 1, -4 + i * 8));
    }
  }

  update(state: AppState): void {
    const below = eraIndexBelow(state.eraFloat);
    const above = eraIndexAbove(state.eraFloat);
    const a = getPalette(ERA_IDS[below]);
    const b = getPalette(ERA_IDS[above]);
    const t = eraBlend(state.eraFloat);

    // Lamps: color + height evolve.
    for (const lamp of this.lamps) {
      lamp.poleMaterial.color.copy(colorBlend(a.buildingAccent, b.buildingAccent, t));
      lamp.headMaterial.color.copy(colorBlend(a.lamp, b.lamp, t));
      lamp.glowMaterial.color.copy(colorBlend(a.lamp, b.lamp, t));
      lamp.glowMaterial.emissive.copy(colorBlend(a.lamp, b.lamp, t));
      lamp.glowMaterial.emissiveIntensity = lerp(0.5, 1.0, a.windowIntensity);
      const h = lerp(a.lampHeight, b.lampHeight, t);
      lamp.pole.scale.y = h;
      lamp.head.position.y = h + 0.2;
      lamp.glow.position.y = h + 0.25;
    }

    // Hydrants / benches / trees: subtle color shifts.
    for (const h of this.hydrants) {
      h.material.color.copy(colorBlend(a.roofProp, b.roofProp, t));
    }
    for (const bench of this.benches) {
      bench.material.color.copy(colorBlend(a.sidewalk, b.sidewalk, t));
    }
    for (const tree of this.trees) {
      tree.trunkMaterial.color.copy(colorBlend(a.building, b.building, t));
      tree.crownMaterial.color.copy(colorBlend(a.roofProp, b.roofProp, t));
    }
    for (const tl of this.trafficLights) {
      tl.material.color.copy(colorBlend(a.signage, b.signage, t));
    }
  }

  private createLamp(x: number, z: number): Lamp {
    const poleMaterial = matColor('#2a2a2a');
    const headMaterial = matColor('#d8a26a');
    const glowMaterial = new MeshStandardMaterial({
      color: colorFromHex('#d8a26a'),
      emissive: colorFromHex('#d8a26a'),
      emissiveIntensity: 0.6,
    });
    const pole = new Mesh(this.poleGeom, poleMaterial);
    pole.scale.y = 3.2;
    pole.position.set(x, 1.6, z);
    const head = new Mesh(this.headGeom, headMaterial);
    head.position.set(x, 3.4, z);
    const glow = new Mesh(this.glowGeom, glowMaterial);
    glow.position.set(x, 3.45, z);
    this.group.add(pole);
    this.group.add(head);
    this.group.add(glow);
    return { pole, poleMaterial, head, headMaterial, glow, glowMaterial, x, z };
  }

  private createHydrant(x: number, z: number): Hydrant {
    const material = matColor('#8a3a3a');
    const mesh = new Mesh(this.hydrantGeom, material);
    mesh.position.set(x, 0.35, z);
    this.group.add(mesh);
    return { mesh, material, x, z };
  }

  private createBench(x: number, z: number): Bench {
    const material = matColor('#6a4a3a');
    const mesh = new Mesh(this.benchGeom, material);
    mesh.position.set(x, 0.5, z);
    this.group.add(mesh);
    return { mesh, material, x, z };
  }

  private createTree(x: number, z: number, rng: Rng): Tree {
    const trunkMaterial = matColor('#5a3a2a');
    const crownMaterial = matColor('#3a6a3a');
    const trunk = new Mesh(this.trunkGeom, trunkMaterial);
    trunk.position.set(x, 0.8, z);
    const crown = new Mesh(this.crownGeom, crownMaterial);
    crown.position.set(x, 2.2, z);
    crown.scale.set(rng.range(0.8, 1.2), rng.range(0.8, 1.2), rng.range(0.8, 1.2));
    this.group.add(trunk);
    this.group.add(crown);
    return { trunk, trunkMaterial, crown, crownMaterial, x, z };
  }

  private createTrafficLight(x: number, z: number): TrafficLight {
    const material = matColor('#2a2a2a');
    const mesh = new Mesh(this.lightGeom, material);
    mesh.position.set(x, 2.6, z);
    this.group.add(mesh);
    return { mesh, material, x, z };
  }

  dispose(): void {
    for (const lamp of this.lamps) {
      lamp.poleMaterial.dispose();
      lamp.headMaterial.dispose();
      lamp.glowMaterial.dispose();
    }
    for (const h of this.hydrants) h.material.dispose();
    for (const bench of this.benches) bench.material.dispose();
    for (const tree of this.trees) {
      tree.trunkMaterial.dispose();
      tree.crownMaterial.dispose();
    }
    for (const tl of this.trafficLights) tl.material.dispose();
    this.poleGeom.dispose();
    this.headGeom.dispose();
    this.glowGeom.dispose();
    this.hydrantGeom.dispose();
    this.benchGeom.dispose();
    this.trunkGeom.dispose();
    this.crownGeom.dispose();
    this.lightGeom.dispose();
  }
}