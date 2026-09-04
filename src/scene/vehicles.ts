/**
 * Vehicles module: era-specific stylized cars driving in lanes, plus
 * flying drones for the 2025 era. Vehicle bodies, wheels and lights are
 * procedural boxes/spheres tweened by era.
 */
import { BoxGeometry, Color, Group, MathUtils, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { EraId, ERA_IDS } from '../eras';
import { clamp, colorBlend, colorFromHex, lerp, matColor, Rng } from '../helpers';
import { getPalette } from '../palette';
import { AppState, eraBlend, eraIndexAbove, eraIndexBelow } from '../state';

interface Vehicle {
  group: Group;
  body: Mesh;
  bodyMaterial: MeshStandardMaterial;
  roof: Mesh;
  roofMaterial: MeshStandardMaterial;
  wheelMaterial: MeshStandardMaterial;
  headlightMaterial: MeshStandardMaterial;
  tailMaterial: MeshStandardMaterial;
  lane: number; // 0 = northbound, 1 = southbound
  speed: number;
  offset: number;
  drone: boolean;
}

export class Vehicles {
  readonly group = new Group();
  private readonly vehicles: Vehicle[] = [];
  private readonly bodyGeom: BoxGeometry;
  private readonly roofGeom: BoxGeometry;
  private readonly wheelGeom: BoxGeometry;
  private readonly lightGeom: SphereGeometry;

  constructor() {
    this.bodyGeom = new BoxGeometry(1, 1, 1);
    this.roofGeom = new BoxGeometry(1, 1, 1);
    this.wheelGeom = new BoxGeometry(0.4, 0.4, 0.2);
    this.lightGeom = new SphereGeometry(0.12, 6, 4);

    const rng = new Rng(0x11aa);
    for (let i = 0; i < 14; i++) {
      const lane = i % 2;
      this.vehicles.push(this.createVehicle(lane, rng));
    }
  }

  update(dt: number, state: AppState): void {
    const below = eraIndexBelow(state.eraFloat);
    const above = eraIndexAbove(state.eraFloat);
    const a = getPalette(ERA_IDS[below]);
    const b = getPalette(ERA_IDS[above]);
    const t = eraBlend(state.eraFloat);

    for (const v of this.vehicles) {
      // Move along lane.
      const dir = v.lane === 0 ? 1 : -1;
      v.offset += v.speed * dt * dir;
      // Wrap around.
      if (v.offset > 30) v.offset = -30;
      if (v.offset < -30) v.offset = 30;

      const laneX = v.lane === 0 ? -2.4 : 2.4;
      v.group.position.x = laneX;
      v.group.position.z = v.offset;

      // Body color by era.
      v.bodyMaterial.color.copy(colorBlend(a.vehicle, b.vehicle, t));
      v.roofMaterial.color.copy(colorBlend(a.buildingAccent, b.buildingAccent, t));

      // Headlights on at night (era-dependent via emissive).
      const night = lerp(0.35, 0.9, a.windowIntensity);
      v.headlightMaterial.emissiveIntensity = night;
      v.tailMaterial.emissiveIntensity = night * 0.7;

      // Drones only in 2025 (era index 4).
      const droneOn = below === 4 && above === 4;
      v.group.visible = v.drone ? droneOn : !v.drone;
    }
  }

  private createVehicle(lane: number, rng: Rng): Vehicle {
    const bodyMaterial = matColor('#5a4a3a');
    const roofMaterial = matColor('#3a3a3a');
    const wheelMaterial = matColor('#1a1a1a');
    const headlightMaterial = new MeshStandardMaterial({
      color: colorFromHex('#e8e8e8'),
      emissive: colorFromHex('#e8e8e8'),
      emissiveIntensity: 0.6,
    });
    const tailMaterial = new MeshStandardMaterial({
      color: colorFromHex('#e04040'),
      emissive: colorFromHex('#e04040'),
      emissiveIntensity: 0.5,
    });

    const group = new Group();
    const body = new Mesh(this.bodyGeom, bodyMaterial);
    body.scale.set(1.9, 0.7, 4.4);
    body.position.y = 0.5;
    const roof = new Mesh(this.roofGeom, roofMaterial);
    roof.scale.set(1.5, 0.35, 2.4);
    roof.position.y = 1.0;
    group.add(body);
    group.add(roof);

    // Wheels.
    for (const [wx, wz] of [
      [-0.8, -1.4],
      [0.8, -1.4],
      [-0.8, 1.4],
      [0.8, 1.4],
    ] as Array<[number, number]>) {
      const wheel = new Mesh(this.wheelGeom, wheelMaterial);
      wheel.position.set(wx, 0.2, wz);
      group.add(wheel);
    }

    // Headlights + taillights.
    for (const [wx, wz, mat] of [
      [-0.6, 2.1, headlightMaterial],
      [0.6, 2.1, headlightMaterial],
      [-0.6, -2.1, tailMaterial],
      [0.6, -2.1, tailMaterial],
    ] as Array<[number, number, MeshStandardMaterial]>) {
      const light = new Mesh(this.lightGeom, mat);
      light.position.set(wx, 0.55, wz);
      group.add(light);
    }

    const drone = rng.next() < 0.25;
    group.position.set(lane === 0 ? -2.4 : 2.4, drone ? 14 : 0, rng.range(-25, 25));
    if (drone) {
      // Flying drone: small glowing hull.
      const hull = new Mesh(this.bodyGeom, bodyMaterial);
      hull.scale.set(0.9, 0.25, 0.9);
      hull.position.y = 0.2;
      group.add(hull);
    }
    this.group.add(group);

    return {
      group,
      body,
      bodyMaterial,
      roof,
      roofMaterial,
      wheelMaterial,
      headlightMaterial,
      tailMaterial,
      lane,
      speed: rng.range(2.5, 5.5),
      offset: rng.range(-25, 25),
      drone,
    };
  }

  dispose(): void {
    for (const v of this.vehicles) {
      v.bodyMaterial.dispose();
      v.roofMaterial.dispose();
      v.wheelMaterial.dispose();
      v.headlightMaterial.dispose();
      v.tailMaterial.dispose();
    }
    this.bodyGeom.dispose();
    this.roofGeom.dispose();
    this.wheelGeom.dispose();
    this.lightGeom.dispose();
  }
}