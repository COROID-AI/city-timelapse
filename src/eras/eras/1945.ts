/**
 * 1945 era — immediate post-war city block.
 *
 * Art direction (architect choice): post-war austerity with visible wartime
 * remnants. Red-brick row buildings with boarded-up blackout windows, sandbag
 * stacks, 'V for Victory' signage and war-bond posters share the street with
 * hand-painted butcher / chemist / general-store fascias, period billboards,
 * cobblestone and patched asphalt paving, cast-iron gas lamps, telephone
 * poles, 1940s sedans and a lettered delivery truck, and pedestrians in suits
 * & fedoras, day dresses and children's outfits.
 *
 * This module registers the era into the shared singleton `eraRegistry` on
 * import (side-effect), so a bare `import '../eras/eras/1945'` is enough to
 * make era 1945 selectable by the main loop. It also exports the read-by-main
 * {@link era1945Providers} bundle so the simulation layer can spawn matching
 * pedestrians and traffic.
 *
 * All geometry and textures are procedural; the texture painter
 * ({@link PaintBuffer}) runs without a DOM canvas, so the composition test can
 * assert real build/update/dispose behavior headlessly in Node.
 */
import * as THREE from 'three';

import { BLOCK, CURB, SIDEWALK, STREET } from '../../layout';
import type { EraContent, EraContext } from '../../types';
import { eraRegistry } from '../registry';

import {
  asphaltTexture,
  billboardTexture,
  brickTexture,
  buildBuilding,
  cobblestoneTexture,
  era1945Providers,
  lamppostGroup,
  pedestrianMesh,
  sedanMesh,
  telephonePoleGroup,
  truckMesh,
  type BuildingSlot,
  type OutfitSpec,
} from './1945.parts';

export { era1945Providers };
export type { Era1945Providers, OutfitVariant, VehicleVariant } from './1945.parts';

/** Real-world position of the row of storefront buildings along the facade. */
const FACADE_Z = -40;

interface Agent {
  group: THREE.Group;
  /** Entry heading; flips when the agent reaches its patrol bounds. */
  dir: number;
  /** Half-extent it patrols along its local x axis. */
  radius: number;
  speed: number;
  /** Local rotation offset applied to a copy of the base outfit/vehicle. */
  baseY: number;
}

/**
 * 1945 era scene. Owns its entire scene graph in a private root group that it
 * attaches to `context.scene` on build and detaches (and releases all
 * geometries/materials/textures it created) on dispose.
 */
class Era1945 implements EraContent {
  readonly isFastPath = true;
  readonly interactivePoints: { id: string; position: THREE.Vector3; label?: string }[] = [];

  private readonly root = new THREE.Group();
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();

  private readonly agents: Agent[] = [];
  private built = false;
  private clock = 0;

  build(context: EraContext): void {
    if (this.built) return;
    this.built = true;

    // -- ground: street (asphalt lanes + cobblestone margins), sidewalks, curbs
    this.buildGround();

    // -- buildings, storefronts, war posters on walls
    const buildings = this.buildBlock(FACADE_Z);

    // -- billboards / painted-wall ads
    this.buildBillboards(buildings);

    // -- infrastructure: lampposts, telephone poles
    this.buildStreetFurniture();

    // -- vehicles parked / rolling on the street
    this.buildVehicles();

    // -- pedestrians in period outfits
    this.buildPedestrians();

    // -- interactive hotspots
    this.buildInteractivePoints();

    context.scene.add(this.root);
  }

  // -------------------------------------------------------------------------
  // Ground
  // -------------------------------------------------------------------------

  private buildGround(): void {
    const streetTex = asphaltTexture();
    const cobbleTex = cobblestoneTexture();
    this.trackTexture(streetTex, cobbleTex);

    const roadMat = new THREE.MeshStandardMaterial({ map: streetTex, roughness: 0.95 });
    this.trackMaterial(roadMat);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK.width + STREET.width * 2, BLOCK.depth + STREET.width * 2), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, 0);
    road.userData.category = 'street';
    this.root.add(road);

    // Cobblestone tram strip running along the centre of the avenue.
    const tramMat = new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.92 });
    this.trackMaterial(tramMat);
    const tram = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK.width + 8, BLOCK.depth + STREET.width * 2), tramMat);
    tram.rotation.x = -Math.PI / 2;
    tram.position.set(0, 0.02, 0);
    tram.userData.category = 'cobblestone';
    this.root.add(tram);

    // sidewalks around the block edge
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xbfb6a4, roughness: 0.95 });
    this.trackMaterial(sideMat);
    // sidewalk slabs running along the four block edges
    const halfDepth = BLOCK.depth / 2 + SIDEWALK.width / 2;
    const halfWidth = BLOCK.width / 2 + SIDEWALK.width / 2;
    const northSouth: Array<{ x: number; z: number }> = [
      { x: 0, z: -halfDepth },
      { x: 0, z: halfDepth },
    ];
    for (const p of northSouth) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(BLOCK.width + SIDEWALK.width * 2, SIDEWALK.height, SIDEWALK.width),
        sideMat,
      );
      mesh.position.set(p.x, SIDEWALK.height / 2, p.z);
      mesh.userData.category = 'sidewalk';
      this.root.add(mesh);
    }
    const eastWest: Array<{ x: number; z: number }> = [
      { x: -halfWidth, z: 0 },
      { x: halfWidth, z: 0 },
    ];
    for (const p of eastWest) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(SIDEWALK.width, SIDEWALK.height, BLOCK.depth + SIDEWALK.width * 2),
        sideMat,
      );
      mesh.position.set(p.x, SIDEWALK.height / 2, p.z);
      mesh.userData.category = 'sidewalk';
      this.root.add(mesh);
    }

    // curbs
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x8d8676, roughness: 0.9 });
    this.trackMaterial(curbMat);
    for (const z of [-BLOCK.depth / 2, BLOCK.depth / 2]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(BLOCK.width + SIDEWALK.width * 2, CURB.height, CURB.depth), curbMat);
      curb.position.set(0, CURB.height / 2, z);
      curb.userData.category = 'curb';
      this.root.add(curb);
    }
    for (const x of [-BLOCK.width / 2, BLOCK.width / 2]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(CURB.depth, CURB.height, BLOCK.depth + SIDEWALK.width * 2), curbMat);
      curb.position.set(x, CURB.height / 2, 0);
      curb.userData.category = 'curb';
      this.root.add(curb);
    }
  }

  // -------------------------------------------------------------------------
  // Buildings & storefronts
  // -------------------------------------------------------------------------

  private buildBlock(facadeZ: number): THREE.Group {
    const block = new THREE.Group();
    block.userData.category = 'block';
    this.root.add(block);
    // collect facade faces of the storefront buildings for ad placement
    const brickTex = brickTexture();
    this.trackTexture(brickTex);

    const slots: BuildingSlot[] = [
      { x: 0, width: 18, floors: 3, store: 'butcher', facadeZ, depth: 14 },
      { x: 21, width: 18, floors: 3, store: 'chemist', facadeZ, depth: 15 },
      { x: 42, width: 18, floors: 3, store: 'general', facadeZ, depth: 14 },
      { x: -21, width: 18, floors: 2, facadeZ, depth: 13 },
      { x: -42, width: 18, floors: 2, facadeZ, depth: 12 },
      { x: 21, width: 12, floors: 3, facadeZ: facadeZ + 4, depth: 12 },
    ];

    for (const slot of slots) {
      const building = buildBuilding(slot, brickTex);
      block.add(building);
    }
    return block;
  }

  private buildBillboards(block: THREE.Group): void {
    const ads: Array<{ pos: THREE.Vector3; rotY: number; list: number }> = [
      { pos: new THREE.Vector3(-54, 8.2, -18), rotY: 0.35, list: 0 },
      { pos: new THREE.Vector3(54, 8.2, -18), rotY: -0.35, list: 1 },
      { pos: new THREE.Vector3(-20, 11, 40), rotY: 0, list: 2 },
    ];
    for (const ad of ads) {
      const buf = billboardTexture(ad.list);
      const mat = new THREE.MeshStandardMaterial({ map: buf, roughness: 0.8 });
      this.trackTexture(buf);
      this.trackMaterial(mat);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), mat);
      plane.position.copy(ad.pos);
      plane.rotation.y = ad.rotY;
      plane.userData.category = 'billboard';
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(16.6, 8.6, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }),
      );
      frame.position.copy(ad.pos);
      frame.rotation.y = ad.rotY;
      frame.userData.category = 'billboard';
      this.root.add(frame, plane);
      // legs
      const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a34, roughness: 0.9 });
      this.trackMaterial(legMat);
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), legMat);
        leg.position.set(ad.pos.x + side * 7, 3.5, ad.pos.z);
        leg.userData.category = 'billboard';
        this.root.add(leg);
      }
    }
    void block;
  }

  private buildStreetFurniture(): void {
    // cast-iron lampposts along the sidewalks
    const lampPositions: Array<[number, number]> = [
      [-46, -44], [-16, -44], [16, -44], [46, -44],
      [-46, 44], [-16, 44], [16, 44], [46, 44],
      [-44, -30], [44, -30], [-44, 30], [44, 30],
    ];
    for (const [x, z] of lampPositions) {
      const lamp = lamppostGroup();
      lamp.position.set(x, 0, z);
      lamp.userData.category = 'lamppost';
      this.root.add(lamp);
    }

    // telephone poles
    const polePositions: Array<[number, number]> = [
      [-52, 20], [-8, 48], [34, 20], [52, -34], [10, -46],
    ];
    for (const [x, z] of polePositions) {
      const pole = telephonePoleGroup();
      pole.position.set(x, 0, z);
      pole.userData.category = 'telephone-pole';
      this.root.add(pole);
    }

    // extra sandbags outside a shopfront corner and by the general store
    const bags = new THREE.Group();
    const bagMat = new THREE.MeshStandardMaterial({ color: 0xa88b54, roughness: 0.95 });
    for (const [x, z] of [[18, -39.6], [30, -39.6], [42, 40]] as Array<[number, number]>) {
      const stack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.6), bagMat);
      stack.position.set(x, 0.3, z);
      stack.userData.category = 'sandbag';
      bags.add(stack);
    }
    this.trackMaterial(bagMat);
    this.root.add(bags);
  }

  // -------------------------------------------------------------------------
  // Vehicles
  // -------------------------------------------------------------------------

  private buildVehicles(): void {
    const spawns: Array<{ x: number; z: number; rotY: number; make: () => THREE.Group }> = [
      { x: -8, z: -52, rotY: 0, make: () => sedanMesh(0x1f2b2e) },
      { x: 8, z: 52, rotY: Math.PI, make: () => sedanMesh(0x2c3a26) },
      { x: -34, z: 52, rotY: Math.PI, make: () => truckMesh() },
      { x: 34, z: -56, rotY: 0, make: () => sedanMesh(0x3a2a22) },
    ];
    for (const s of spawns) {
      const v = s.make();
      v.position.set(s.x, 0.02, s.z);
      v.rotation.y = s.rotY;
      v.userData.category = 'vehicle';
      this.root.add(v);
      this.agents.push({
        group: v,
        dir: s.rotY === 0 ? 1 : -1,
        radius: 30 + Math.abs(s.x) * 0.1,
        speed: 0.35 + Math.abs(s.x % 7) * 0.03,
        baseY: s.rotY,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Pedestrians
  // -------------------------------------------------------------------------

  private buildPedestrians(): void {
    const dress: OutfitSpec = { id: 'woman-dress', label: 'Woman in day dress', coat: 0x7a4a52, pants: 0x7a4a52, skirt: 0x7a4a52 };
    const suit: OutfitSpec = { id: 'man-suit', label: 'Man in suit & fedora', coat: 0x3a4446, pants: 0x2c2c30, hat: 0x2c2c30 };
    const cap: OutfitSpec = { id: 'man-cap', label: 'Worker in flat cap', coat: 0x55604a, pants: 0x3c4036, hat: 0x3c4036 };
    const coat: OutfitSpec = { id: 'woman-coat', label: 'Woman in wool coat', coat: 0x2f3a4a, pants: 0x2f3a4a, skirt: 0x2f3a4a };
    const child: OutfitSpec = { id: 'child', label: 'Child', coat: 0xa25b3a, pants: 0x3a3f44 };

    const sidewalkZ = BLOCK.depth / 2 + SIDEWALK.width / 2;
    const sidewalkX = BLOCK.width / 2 + SIDEWALK.width / 2;
    const spots: Array<{ x: number; z: number; rotY: number; spec: OutfitSpec }> = [
      { x: -30, z: -sidewalkZ, rotY: 0, spec: suit },
      { x: -14, z: -sidewalkZ, rotY: 0, spec: dress },
      { x: 4, z: -sidewalkZ, rotY: 0, spec: cap },
      { x: 22, z: -sidewalkZ, rotY: 0, spec: coat },
      { x: 38, z: -sidewalkZ, rotY: 0, spec: child },
      { x: -40, z: sidewalkZ, rotY: Math.PI, spec: dress },
      { x: -22, z: sidewalkZ, rotY: Math.PI, spec: suit },
      { x: -6, z: sidewalkZ, rotY: Math.PI, spec: child },
      { x: 12, z: sidewalkZ, rotY: Math.PI, spec: coat },
      { x: 30, z: sidewalkZ, rotY: Math.PI, spec: cap },
      { x: 48, z: 26, rotY: Math.PI / 2, spec: suit },
      { x: 48, z: -2, rotY: Math.PI / 2, spec: dress },
      { x: -48, z: 34, rotY: -Math.PI / 2, spec: cap },
      { x: -48, z: -6, rotY: -Math.PI / 2, spec: coat },
    ];
    for (const s of spots) {
      const p = pedestrianMesh(s.spec);
      p.position.set(s.x, 0, s.z);
      p.rotation.y = s.rotY;
      p.userData.category = 'pedestrian';
      this.root.add(p);
      const walkingAlongX = Math.abs(s.z) === sidewalkZ;
      this.agents.push({
        group: p,
        dir: walkingAlongX ? 1 : -1,
        radius: walkingAlongX ? 44 : 30,
        speed: 0.5 + ((Math.abs(s.x) + Math.abs(s.z)) % 10) * 0.04,
        baseY: s.rotY,
      });
    }
    void sidewalkX;
  }

  // -------------------------------------------------------------------------
  // Interactive points
  // -------------------------------------------------------------------------

  private buildInteractivePoints(): void {
    this.interactivePoints.push(
      { id: '1945-general-store', position: new THREE.Vector3(42, 1.5, -38.5), label: 'V for Victory general store' },
      { id: '1945-butcher', position: new THREE.Vector3(0, 1.5, -38.5), label: 'Victory Butcher' },
      { id: '1945-chemist', position: new THREE.Vector3(21, 1.5, -37.5), label: 'Chemist - fine drugs' },
      { id: '1945-delivery-truck', position: new THREE.Vector3(-34, 1.5, 51), label: 'Victory Delivery truck' },
      { id: '1945-lamppost', position: new THREE.Vector3(-46, 2.5, -44), label: 'Cast-iron gas lamp (blackout era)' },
    );
  }

  // -------------------------------------------------------------------------
  // Update / dispose
  // -------------------------------------------------------------------------

  update(delta: number): void {
    if (!this.built) return;
    this.clock += delta;

    for (const agent of this.agents) {
      // patrol along local x, reversing at bounds; heading follows direction
      agent.group.position.x += agent.dir * agent.speed * delta;
      if (agent.group.position.x > agent.radius) {
        agent.group.position.x = agent.radius;
        agent.dir = -1;
        agent.group.rotation.y = agent.baseY + Math.PI;
      } else if (agent.group.position.x < -agent.radius) {
        agent.group.position.x = -agent.radius;
        agent.dir = 1;
        agent.group.rotation.y = agent.baseY;
      }
    }
  }

  dispose(): void {
    // detach and release everything we created
    this.root.removeFromParent();

    for (const d of this.disposables) {
      try {
        d.dispose();
      } catch {
        // ignore resource-release errors: object already gone
      }
    }
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();

    this.disposables.length = 0;
    this.materials.clear();
    this.textures.clear();
    this.agents.length = 0;
    this.built = false;
  }

  // -- resource tracking helpers ----------------------------------------------

  private trackMaterial(m: THREE.Material): void {
    this.materials.add(m);
  }

  private trackTexture(...tex: THREE.Texture[]): void {
    for (const t of tex) this.textures.add(t);
  }
}

/** The instantiated 1945 era content bound to the singleton registry. */
const era1945 = new Era1945();

// Side-effect registration: importing this module makes era 1945 selectable.
eraRegistry.registerEra('1945', era1945);

export default era1945;