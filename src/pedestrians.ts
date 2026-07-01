// Pedestrians: five outfit styles (forties..twenties). Like vehicles they
// cross-fade during transitions. Each walker paces a segment of the sidewalk.

import * as THREE from 'three';
import { EraConfig, PedestrianOutfit } from './eras';
import { RNG } from './rng';

const GEO = {
  torso: new THREE.CapsuleGeometry(0.22, 0.5, 4, 8),
  head: new THREE.SphereGeometry(0.17, 12, 10),
  limb: new THREE.CapsuleGeometry(0.09, 0.34, 4, 6),
  hat: new THREE.ConeGeometry(0.2, 0.22, 10),
};

interface PedParts {
  group: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  pantsMat: THREE.MeshStandardMaterial;
  skinMat: THREE.MeshStandardMaterial;
  hat: THREE.Mesh | null;
  hatMat: THREE.MeshStandardMaterial | null;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
}

function buildOutfit(outfit: PedestrianOutfit, era: EraConfig, seed: number): PedParts {
  const rng = new RNG(seed);
  const shirtMat = new THREE.MeshStandardMaterial({
    color: rng.pick(era.shirtColors),
    roughness: 0.8,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: rng.pick(era.pantsColors),
    roughness: 0.85,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: rng.pick(era.skinTones),
    roughness: 0.7,
  });

  const group = new THREE.Group();
  const torso = new THREE.Mesh(GEO.torso, shirtMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(GEO.head, skinMat);
  head.position.y = 1.62;
  group.add(head);

  const leftLeg = new THREE.Mesh(GEO.limb, pantsMat);
  leftLeg.position.set(-0.1, 0.45, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(GEO.limb, pantsMat);
  rightLeg.position.set(0.1, 0.45, 0);
  group.add(rightLeg);

  let hat: THREE.Mesh | null = null;
  let hatMat: THREE.MeshStandardMaterial | null = null;

  if (outfit === 'forties' || era.hatColor !== null) {
    hatMat = new THREE.MeshStandardMaterial({ color: era.hatColor ?? 0x2a2a30, roughness: 0.8 });
    hat = new THREE.Mesh(GEO.hat, hatMat);
    hat.position.y = 1.82;
    group.add(hat);
  }

  // Outfit-specific silhouettes
  if (outfit === 'eighties') {
    // big shoulder pads -> wider torso
    torso.scale.set(1.25, 1, 1);
  } else if (outfit === 'twenties') {
    // slim fit
    torso.scale.set(0.9, 1.05, 1);
  } else if (outfit === 'aughts') {
    // messenger-bag-ish accent (a thin box on the torso)
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.9 });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.08), bagMat);
    bag.position.set(0.18, 1.2, 0.18);
    bag.castShadow = true;
    group.add(bag);
  }

  return { group, shirtMat, pantsMat, skinMat, hat, hatMat, leftLeg, rightLeg };
}

export class Pedestrian {
  readonly group = new THREE.Group();
  private readonly pathMin: number;
  private readonly pathMax: number;
  private dir: 1 | -1;
  private speed = 1.1;
  private seed: number;
  private currentOutfit: PedestrianOutfit | null = null;
  private parts: PedParts | null = null;
  private phase: number;

  constructor(seed: number, sidewalkZ: number) {
    this.seed = seed;
    const rng = new RNG(seed);
    this.pathMin = -40 + rng.next() * 10;
    this.pathMax = 40 - rng.next() * 10;
    this.dir = rng.next() > 0.5 ? 1 : -1;
    this.phase = rng.next() * Math.PI * 2;
    const startX = rng.range(this.pathMin, this.pathMax);
    this.group.position.set(startX, 0, sidewalkZ);
  }

  private rebuild(outfit: PedestrianOutfit, era: EraConfig): void {
    if (this.parts) {
      this.group.remove(this.parts.group);
      [this.parts.shirtMat, this.parts.pantsMat, this.parts.skinMat, this.parts.hatMat].forEach(
        (m) => m?.dispose(),
      );
    }
    this.parts = buildOutfit(outfit, era, this.seed);
    this.currentOutfit = outfit;
    this.group.add(this.parts.group);
  }

  setEra(from: EraConfig, to: EraConfig, t: number): void {
    const active = t < 0.5 ? from : to;
    if (active.outfit !== this.currentOutfit) this.rebuild(active.outfit, active);
    const fade = Math.abs(t - 0.5) * 2;
    this.group.visible = fade > 0.18;
  }

  update(dt: number): void {
    let x = this.group.position.x + this.dir * this.speed * dt;
    if (x > this.pathMax) {
      x = this.pathMax;
      this.dir = -1;
    } else if (x < this.pathMin) {
      x = this.pathMin;
      this.dir = 1;
    }
    this.group.position.x = x;
    this.group.rotation.y = this.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    // walking legs
    const t = performance.now() * 0.006 + this.phase;
    if (this.parts) {
      this.parts.leftLeg.rotation.x = Math.sin(t) * 0.5;
      this.parts.rightLeg.rotation.x = -Math.sin(t) * 0.5;
    }
  }

  setSpeed(s: number): void {
    this.speed = s;
  }
}
