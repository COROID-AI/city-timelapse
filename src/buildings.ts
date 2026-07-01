// Building module: a textured block whose colour, height, window-glow and neon
// sign are all driven by the current (interpolated) EraConfig.

import * as THREE from 'three';
import { EraConfig } from './eras';
import { makeFacadeTextures, makeSignTexture } from './procedural';
import { RNG } from './rng';

const _col = new THREE.Color();

export interface BuildingOptions {
  pos: THREE.Vector3;
  width: number;
  depth: number;
  floors: number;
  paletteIndex: number;
  seed: number;
  /** Which face the neon sign faces ('+z' or '-z'). */
  signFace: '+z' | '-z';
}

export class Building {
  readonly group = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly sign: THREE.Mesh;
  private readonly signMaterial: THREE.MeshBasicMaterial;
  private readonly width: number;
  private readonly depth: number;
  private readonly paletteIndex: number;
  private readonly heightFactor: number; // 0..1 position within the era's height range
  private readonly signFace: '+z' | '-z';
  private currentSignEraColor = -1;

  constructor(opts: BuildingOptions) {
    this.width = opts.width;
    this.depth = opts.depth;
    this.paletteIndex = opts.paletteIndex;
    this.signFace = opts.signFace;

    const rng = new RNG(opts.seed);
    this.heightFactor = rng.next(); // stable per building

    const facades = makeFacadeTextures(opts.seed, opts.floors);
    const repeatX = Math.max(1, Math.round(opts.width / 3.4));
    facades.map.repeat.set(repeatX, 1);
    facades.emissive.repeat.set(repeatX, 1);

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: facades.map,
      emissiveMap: facades.emissive,
      emissive: new THREE.Color(0xffcf7a),
      emissiveIntensity: 0.8,
      roughness: 0.9,
      metalness: 0.0,
    });

    this.body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.material);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.group.add(this.body);

    // Rooftop detailing: a small penthouse box + an AC unit.
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.9 });
    const pent = new THREE.Mesh(new THREE.BoxGeometry(opts.width * 0.3, 1.2, opts.depth * 0.3), roofMat);
    pent.castShadow = true;
    pent.name = 'penthouse';
    this.group.add(pent);

    // Neon sign plane.
    this.signMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(opts.width * 0.8, 2.2), this.signMaterial);
    this.sign.name = 'sign';
    this.group.add(this.sign);

    this.group.position.copy(opts.pos);
  }

  /** Continuous per-frame update from the interpolated era. */
  applyEraContinuous(state: EraConfig): void {
    const targetH =
      state.heightRange[0] + (state.heightRange[1] - state.heightRange[0]) * this.heightFactor;

    this.body.scale.set(this.width, targetH, this.depth);
    this.body.position.y = targetH / 2;

    const pent = this.group.getObjectByName('penthouse');
    if (pent) pent.position.set(0, targetH + 0.6, 0);

    const baseColor = state.buildingColors[this.paletteIndex % state.buildingColors.length];
    this.material.color.set(baseColor);
    this.material.emissive.set(state.windowColor);
    this.material.emissiveIntensity = state.windowEmissive;
    this.material.roughness = state.roughness;
    this.material.metalness = state.metalness;

    // Place sign near the top of the building on the chosen face.
    const signY = targetH * 0.82;
    const signZ = this.signFace === '+z' ? this.depth / 2 + 0.08 : -(this.depth / 2 + 0.08);
    this.sign.position.set(0, signY, signZ);
    this.sign.rotation.y = this.signFace === '+z' ? 0 : Math.PI;
  }

  /** Discrete update — call when the active era index changes (signage swap). */
  applyEraDiscrete(state: EraConfig): void {
    const text = state.signTexts[this.paletteIndex % state.signTexts.length] ?? 'CITY';
    // Avoid rebuilding an identical sign texture.
    if (state.neonColor === this.currentSignEraColor && this.signMaterial.map) return;
    this.currentSignEraColor = state.neonColor;
    const old = this.signMaterial.map;
    this.signMaterial.map = makeSignTexture(text, state.neonColor);
    this.signMaterial.needsUpdate = true;
    if (old) old.dispose();
  }

  dispose(): void {
    this.material.map?.dispose();
    this.material.emissiveMap?.dispose();
    this.signMaterial.map?.dispose();
    this.material.dispose();
    this.signMaterial.dispose();
    (this.body.geometry as THREE.BufferGeometry).dispose();
    (this.sign.geometry as THREE.BufferGeometry).dispose();
  }
}

// keep _col referenced for future palette math without noUnusedLocals tripping.
void _col;
