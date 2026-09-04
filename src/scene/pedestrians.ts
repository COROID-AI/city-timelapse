/**
 * Pedestrians module: small stylized figures walking on sidewalks. Outfits
 * (body + hat + leg colors) follow the era palette; walk cycles are simple
 * bobbing so the block feels alive.
 */
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { EraId, ERA_IDS } from '../eras';
import { colorBlend, lerp, matColor, Rng } from '../helpers';
import { getPalette } from '../palette';
import { AppState, eraBlend, eraIndexAbove, eraIndexBelow } from '../state';

interface Pedestrian {
  group: Group;
  bodyMaterial: MeshStandardMaterial;
  headMaterial: MeshStandardMaterial;
  hatMaterial: MeshStandardMaterial;
  legMaterial: MeshStandardMaterial;
  side: number; // -1 left sidewalk, +1 right sidewalk
  offset: number;
  speed: number;
  phase: number;
}

export class Pedestrians {
  readonly group = new Group();
  private readonly pedestrians: Pedestrian[] = [];
  private readonly bodyGeom: BoxGeometry;
  private readonly headGeom: BoxGeometry;

  constructor() {
    this.bodyGeom = new BoxGeometry(0.5, 1.0, 0.35);
    this.headGeom = new BoxGeometry(0.3, 0.3, 0.3);
    const rng = new Rng(0x77cc);
    for (let i = 0; i < 10; i++) {
      this.pedestrians.push(this.createPedestrian(i % 2 === 0 ? -1 : 1, rng));
    }
  }

  update(dt: number, state: AppState): void {
    const below = eraIndexBelow(state.eraFloat);
    const above = eraIndexAbove(state.eraFloat);
    const a = getPalette(ERA_IDS[below]);
    const b = getPalette(ERA_IDS[above]);
    const t = eraBlend(state.eraFloat);

    for (const p of this.pedestrians) {
      p.offset += p.speed * dt * p.side;
      if (p.offset > 28) p.offset = -28;
      if (p.offset < -28) p.offset = 28;

      const x = p.side * 5.2;
      p.group.position.x = x;
      p.group.position.z = p.offset;
      // Walk bob.
      p.group.position.y = Math.abs(Math.sin(state.eraFloat * 3 + p.phase)) * 0.08;

      // Outfit colors by era.
      p.bodyMaterial.color.copy(colorBlend(a.pedestrian, b.pedestrian, t));
      p.hatMaterial.color.copy(colorBlend(a.buildingAccent, b.buildingAccent, t));
      p.legMaterial.color.copy(colorBlend(a.road, b.road, t));
    }
  }

  private createPedestrian(side: number, rng: Rng): Pedestrian {
    const bodyMaterial = matColor('#4a5a3a');
    const headMaterial = matColor('#d8b090');
    const hatMaterial = matColor('#3a3a3a');
    const legMaterial = matColor('#2a2a2a');

    const group = new Group();
    const body = new Mesh(this.bodyGeom, bodyMaterial);
    body.position.y = 0.75;
    const head = new Mesh(this.headGeom, headMaterial);
    head.position.y = 1.45;
    const hat = new Mesh(this.headGeom, hatMaterial);
    hat.scale.set(0.36, 0.14, 0.36);
    hat.position.y = 1.7;
    const legL = new Mesh(this.bodyGeom, legMaterial);
    legL.scale.set(0.14, 0.6, 0.14);
    legL.position.set(-0.1, 0.3, 0);
    const legR = new Mesh(this.bodyGeom, legMaterial);
    legR.scale.set(0.14, 0.6, 0.14);
    legR.position.set(0.1, 0.3, 0);
    group.add(body);
    group.add(head);
    group.add(hat);
    group.add(legL);
    group.add(legR);
    group.position.set(side * 5.2, 0, rng.range(-25, 25));
    this.group.add(group);

    return {
      group,
      bodyMaterial,
      headMaterial,
      hatMaterial,
      legMaterial,
      side,
      offset: rng.range(-25, 25),
      speed: rng.range(0.8, 1.8),
      phase: rng.range(0, Math.PI * 2),
    };
  }

  dispose(): void {
    for (const p of this.pedestrians) {
      p.bodyMaterial.dispose();
      p.headMaterial.dispose();
      p.hatMaterial.dispose();
      p.legMaterial.dispose();
    }
    this.bodyGeom.dispose();
    this.headGeom.dispose();
  }
}