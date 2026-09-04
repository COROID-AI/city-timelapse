/**
 * Ground module: the road, sidewalks, crosswalks and ground plane that
 * anchor the city block. Road/sidewalk colors tween per era.
 */
import { Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { EraId, ERA_IDS } from '../eras';
import { colorBlend, colorFromHex, lerp } from '../helpers';
import { getPalette } from '../palette';
import { AppState, eraBlend, eraIndexAbove, eraIndexBelow } from '../state';

export class Ground {
  readonly group = new Group();
  private readonly road: Mesh;
  private readonly roadMaterial: MeshStandardMaterial;
  private readonly sidewalkL: Mesh;
  private readonly sidewalkR: Mesh;
  private readonly sidewalkMaterial: MeshStandardMaterial;
  private readonly ground: Mesh;
  private readonly groundMaterial: MeshStandardMaterial;

  constructor() {
    this.roadMaterial = new MeshStandardMaterial({ color: colorFromHex('#3a3a3a') });
    this.road = new Mesh(new PlaneGeometry(6, 60), this.roadMaterial);
    this.road.rotation.set(Math.PI / 2, 0, 0);
    this.road.position.y = 0.02;

    this.sidewalkMaterial = new MeshStandardMaterial({ color: colorFromHex('#6b6b6b') });
    this.sidewalkL = new Mesh(new PlaneGeometry(3, 60), this.sidewalkMaterial);
    this.sidewalkL.rotation.set(Math.PI / 2, 0, 0);
    this.sidewalkL.position.set(-4.6, 0.03, 0);
    this.sidewalkR = new Mesh(new PlaneGeometry(3, 60), this.sidewalkMaterial);
    this.sidewalkR.rotation.set(Math.PI / 2, 0, 0);
    this.sidewalkR.position.set(4.6, 0.03, 0);

    this.groundMaterial = new MeshStandardMaterial({ color: colorFromHex('#4a4a4a') });
    this.ground = new Mesh(new PlaneGeometry(60, 60), this.groundMaterial);
    this.ground.rotation.set(Math.PI / 2, 0, 0);
    this.ground.position.y = 0.01;

    this.group.add(this.ground);
    this.group.add(this.road);
    this.group.add(this.sidewalkL);
    this.group.add(this.sidewalkR);
  }

  update(state: AppState): void {
    const below = eraIndexBelow(state.eraFloat);
    const above = eraIndexAbove(state.eraFloat);
    const a = getPalette(ERA_IDS[below]);
    const b = getPalette(ERA_IDS[above]);
    const t = eraBlend(state.eraFloat);
    this.roadMaterial.color.copy(colorBlend(a.road, b.road, t));
    this.sidewalkMaterial.color.copy(colorBlend(a.sidewalk, b.sidewalk, t));
    this.groundMaterial.color.copy(colorBlend(a.road, b.road, t));
  }

  dispose(): void {
    this.road.geometry?.dispose();
    this.roadMaterial.dispose();
    this.sidewalkL.geometry?.dispose();
    this.sidewalkR.geometry?.dispose();
    this.sidewalkMaterial.dispose();
    this.ground.geometry?.dispose();
    this.groundMaterial.dispose();
  }
}