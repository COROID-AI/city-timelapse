import * as THREE from 'three';

import { BLOCK, CURB, SIDEWALK, STREET } from '../../layout';
import { eraRegistry } from '../registry';
import type { EraContent, EraContext, EraId } from '../../types';
import {
  PALETTE,
  STREET_GEOM,
  billboardMaterial,
  box,
  buildBusStop,
  buildMailbox,
  buildMotorbike,
  buildParkingMeter,
  buildPedestrian,
  buildPhoneBooth,
  buildSedan,
  buildStationWagon,
  buildStreetlight,
  crosswalkMaterial,
  laneStripeMaterial,
  neonSignMaterial,
  spike,
  type Outfit,
} from './1965.parts';

/**
 * 1965 era — a mid-century city block.
 *
 * Art direction: the post-war consumer boom. Chrome-laden sedans and station
 * wagons, neon strip signage, googie rocket accents, pastel storefronts, and
 * pedestrians in slim suits, shift dresses and pencil skirts. Everything is
 * procedural geometry + canvas textures (no binary assets) and respects the
 * shared layout constants in src/layout.ts.
 *
 * Registration happens as a side effect of importing this module, and the
 * scene is built on era selection, updated per frame, and disposed on switch.
 */

/** The era id this module owns. */
const ERA_ID: EraId = '1965';

/** Pedestrian colourways: slim suits, shift dresses and pencil skirts. */
const OUTFITS: Outfit[] = [
  { top: '#3a5f8f', bottom: '#2f3a4a', skin: '#e8c8a0', hair: '#3a332b' }, // navy suit
  { top: '#6b4a2f', bottom: '#4a3a28', skin: '#e8c8a0', hair: '#241c14' }, // brown suit
  { top: '#c0392b', bottom: '#2f2f2f', skin: '#e8c8a0', hair: '#1c1c1c' }, // red suit
  { top: '#3fb9b0', bottom: '#f2f2f2', skin: '#e0b890', hair: '#d4a35a' }, // turquoise shift dress
  { top: '#f06292', bottom: '#f6f1e2', skin: '#e0b890', hair: '#241c14' }, // pink shift dress
  { top: '#e8862e', bottom: '#2f2f2f', skin: '#c99a70', hair: '#1c1c1c' }, // orange skirt
  { top: '#7a6a9a', bottom: '#3a3a3a', skin: '#e8c8a0', hair: '#5a4a3a' }, // violet pencil skirt
  { top: '#2f6f5f', bottom: '#f6f1e2', skin: '#e0b890', hair: '#8a6a4a' }, // green shift dress
  { top: '#8a2f2f', bottom: '#2f2a26', skin: '#c99a70', hair: '#241c14' }, // maroon suit
  { top: '#3a3a5f', bottom: '#f6f1e2', skin: '#e8c8a0', hair: '#d4a35a' }, // blue dress
];

/** Billboard copy with a 1960s consumer-optimism voice. */
const BILLBOARDS: { headline: string; subtitle: string; field: string; accent: string }[] = [
  { headline: 'NEW!', subtitle: 'The 1965 Bel-Air — Own the Future', field: PALETTE.coral, accent: PALETTE.yellow },
  { headline: 'COOL', subtitle: 'Fizz-O Cola — Taste the Space Age', field: PALETTE.turquoise, accent: PALETTE.pink },
  { headline: 'FLY', subtitle: 'Sunjet Airlines — Fly Jet Age', field: PALETTE.yellow, accent: PALETTE.teal },
];

/** Storefront descriptors: diner, record shop and car showroom. */
const STOREFRONTS = [
  { kind: 'diner', label: "DIXIE'S DINER", base: PALETTE.coral, accent: PALETTE.cream, neon: PALETTE.pink },
  { kind: 'records', label: 'HI-FI RECORDS', base: PALETTE.turquoise, accent: PALETTE.cream, neon: PALETTE.yellow },
  { kind: 'showroom', label: 'BEL-AIR CARS', base: PALETTE.chrome, accent: PALETTE.teal, neon: PALETTE.orange },
] as const;

/** World-space slots for each storefront along the front sidewalk. */
const STOREFRONT_SLOTS: { x: number; z: number }[] = [
  { x: -36, z: BLOCK.depth / 2 + SIDEWALK.width },
  { x: -4, z: BLOCK.depth / 2 + SIDEWALK.width },
  { x: 30, z: BLOCK.depth / 2 + SIDEWALK.width },
];

/** The interactive points (hotspots) for this era. Populated at module load
 *  and refreshed on build; cleared on dispose. */
const makeInteractivePoints = (): NonNullable<EraContent['interactivePoints']> => [
  {
    id: 'diner',
    position: new THREE.Vector3(STOREFRONT_SLOTS[0].x, 1.0, STOREFRONT_SLOTS[0].z + 2.4),
    label: "DIXIE'S DINER",
  },
  {
    id: 'record-shop',
    position: new THREE.Vector3(STOREFRONT_SLOTS[1].x, 1.0, STOREFRONT_SLOTS[1].z + 2.4),
    label: 'HI-FI RECORDS',
  },
  {
    id: 'car-showroom',
    position: new THREE.Vector3(STOREFRONT_SLOTS[2].x, 1.0, STOREFRONT_SLOTS[2].z + 2.4),
    label: 'BEL-AIR CARS',
  },
  {
    id: 'bus-stop',
    position: new THREE.Vector3(48, 1.0, BLOCK.depth / 2 + SIDEWALK.width + 1.6),
    label: 'Bus Stop',
  },
  {
    id: 'phone-booth',
    position: new THREE.Vector3(-52, 1.0, BLOCK.depth / 2 + SIDEWALK.width + 1.6),
    label: 'Phone Booth',
  },
  {
    id: 'mailbox',
    position: new THREE.Vector3(34, 1.0, BLOCK.depth / 2 + SIDEWALK.width + 1.6),
    label: 'Mailbox',
  },
];

// --- Module-level mutable state (kept private to this file) ---
let rootGroup: THREE.Group | null = null;
let vehiclesGroup: THREE.Group | null = null;
let pedestriansGroup: THREE.Group | null = null;
let disposed = true;
let clock = 0;

/**
 * The era content, exported for the registry and for main-integration.
 * Build populates the scene graph into `context.scene`; update animates the
 * pedestrians and vehicles; dispose tears everything down on era switch.
 */
export const era1965: EraContent = {
  isFastPath: true,

  interactivePoints: makeInteractivePoints(),

  build(context: EraContext): void {
    const root = new THREE.Group();
    root.name = 'era-1965';
    context.scene.add(root);

    // ---- Asphalt road with painted markings ----
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(BLOCK.width + STREET.width * 2, 0.15, BLOCK.depth + STREET.width * 2),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.asphalt) }),
    );
    road.position.set(0, -0.075, 0);
    root.add(road);

    // Lane stripes (dashed centre line along the road).
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(BLOCK.width + STREET.width * 2, 0.02, 0.4),
      laneStripeMaterial(),
    );
    stripe.position.set(0, 0.02, 0);
    root.add(stripe);

    // Crosswalk zebra crossing at the front edge.
    const cross = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.02, 2.6),
      crosswalkMaterial(),
    );
    cross.position.set(0, 0.02, STREET_GEOM.innerEdge + 1.3);
    root.add(cross);

    // ---- Sidewalk slabs flanking the block ----
    const slab = (z: number) => {
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(BLOCK.width + STREET.width * 2, SIDEWALK.height, SIDEWALK.width),
        new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9c2b0') }),
      );
      s.position.set(0, SIDEWALK.height / 2, z);
      root.add(s);
    };
    slab(BLOCK.depth / 2 + SIDEWALK.width / 2);
    slab(-(BLOCK.depth / 2 + SIDEWALK.width / 2));

    // Curbs.
    const curb = (z: number) => {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(BLOCK.width + STREET.width * 2, CURB.height, CURB.depth),
        new THREE.MeshStandardMaterial({ color: new THREE.Color('#b5afa0') }),
      );
      c.position.set(0, CURB.height / 2, z);
      root.add(c);
    };
    curb(STREET_GEOM.innerEdge - CURB.depth / 2);
    curb(-(STREET_GEOM.innerEdge - CURB.depth / 2));

    // ---- Buildings along the back of the block ----
    const buildingSlots = [
      { x: -46, w: 20, h: 18, z: BLOCK.depth / 2 - 14, base: PALETTE.mint, accent: PALETTE.turquoise },
      { x: -14, w: 22, h: 24, z: BLOCK.depth / 2 - 14, base: PALETTE.cream, accent: PALETTE.coral },
      { x: 16, w: 18, h: 16, z: BLOCK.depth / 2 - 14, base: PALETTE.turquoise, accent: PALETTE.yellow },
      { x: 44, w: 16, h: 20, z: BLOCK.depth / 2 - 14, base: PALETTE.coral, accent: PALETTE.teal },
      { x: -52, w: 14, h: 14, z: BLOCK.depth / 2 - 34, base: PALETTE.yellow, accent: PALETTE.teal },
      { x: 34, w: 16, h: 18, z: BLOCK.depth / 2 - 36, base: PALETTE.mint, accent: PALETTE.pink },
    ];
    for (const slot of buildingSlots) {
      const building = new THREE.Group();
      building.name = 'building';

      const mass = box(slot.w, slot.h, 18, slot.base);
      mass.position.set(0, slot.h / 2, 0);
      building.add(mass);

      // Mid-century facade band.
      const band = box(slot.w + 0.4, 1.6, 0.3, slot.accent);
      band.position.set(0, slot.h * 0.72, 9.2);
      building.add(band);

      // Glass storefront base.
      const glass = box(slot.w - 1.5, 3.4, 0.3, '#bfe8e0');
      glass.position.set(0, 1.7, 9.1);
      building.add(glass);

      // Googie rocket spike on the roof.
      const spikeMesh = spike(0.5, 1.6, PALETTE.chrome);
      spikeMesh.position.set(0, slot.h + 0.8, 0);
      building.add(spikeMesh);

      building.position.set(slot.x, 0, slot.z);
      root.add(building);
    }

    // ---- Storefronts (diner, record shop, car showroom) ----
    for (let i = 0; i < STOREFRONTS.length; i++) {
      const store = STOREFRONTS[i];
      const slot = STOREFRONT_SLOTS[i];
      const group = new THREE.Group();
      group.name = `storefront-${store.kind}`;

      // Awning.
      const awning = box(9, 0.12, 3.2, store.accent);
      awning.position.set(0, 3.1, 1.6);
      group.add(awning);

      // Neon strip sign above the awning.
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(8.6, 1.1, 0.3),
        neonSignMaterial(store.label, store.neon, store.base),
      );
      sign.position.set(0, 4.0, 1.8);
      group.add(sign);

      // Showroom extra: big glass window + chrome frame.
      if (store.kind === 'showroom') {
        const window = box(8, 2.4, 0.2, '#cfe8f0');
        window.position.set(0, 2.0, 1.6);
        group.add(window);
        const frame = box(8.6, 0.18, 0.3, PALETTE.chrome);
        frame.position.set(0, 3.3, 1.7);
        group.add(frame);

        // A chrome sedan displayed in the window.
        const display = buildSedan(PALETTE.turquoise);
        display.position.set(0, 0.3, 0.4);
        display.scale.set(0.85, 0.85, 0.85);
        group.add(display);
      }

      // Diner extra: counter stools.
      if (store.kind === 'diner') {
        for (let s = -1; s <= 1; s++) {
          const stool = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.8, 10),
            new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.chrome) }),
          );
          stool.position.set(s * 1.4, 0.4, 2.4);
          group.add(stool);
        }
      }

      // Record shop extra: record display rack.
      if (store.kind === 'records') {
        const rack = box(6, 1.6, 0.3, '#2f2a26');
        rack.position.set(0, 0.9, 2.2);
        group.add(rack);
        for (let r = -2; r <= 2; r++) {
          const record = box(0.08, 1.2, 0.28, r % 2 === 0 ? PALETTE.pink : PALETTE.yellow);
          record.position.set(r * 1.1, 0.9, 2.36);
          group.add(record);
        }
      }

      group.position.set(slot.x, 0, slot.z);
      root.add(group);
    }

    // ---- Billboards ----
    const billboardSlots = [
      { x: -58, z: BLOCK.depth / 2 - 8, rotY: Math.PI / 2 },
      { x: 58, z: BLOCK.depth / 2 - 8, rotY: -Math.PI / 2 },
      { x: 0, z: -(BLOCK.depth / 2 + SIDEWALK.width + 6), rotY: 0 },
    ];
    for (let b = 0; b < BILLBOARDS.length; b++) {
      const spec = BILLBOARDS[b];
      const slot = billboardSlots[b];
      const board = new THREE.Group();
      board.name = 'billboard';

      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(10, 5, 0.3),
        billboardMaterial(spec.headline, spec.subtitle, spec.field, spec.accent),
      );
      panel.position.set(0, 3.2, 0);
      board.add(panel);

      const leg = box(0.4, 3.2, 0.4, '#2f2a26');
      leg.position.set(0, 1.6, 0);
      board.add(leg);

      board.position.set(slot.x, 0, slot.z);
      board.rotation.set(0, slot.rotY, 0);
      root.add(board);
    }

    // ---- Vehicles on the street ----
    const vehicles = new THREE.Group();
    vehicles.name = 'vehicles';
    const vehicleSpecs: { build: () => THREE.Group; x: number; z: number }[] = [
      { build: () => buildSedan(PALETTE.coral), x: -24, z: STREET_GEOM.innerEdge + 3.4 },
      { build: () => buildSedan(PALETTE.turquoise), x: 18, z: STREET_GEOM.innerEdge + 3.6 },
      { build: () => buildSedan(PALETTE.yellow), x: 42, z: STREET_GEOM.innerEdge + 3.2 },
      { build: () => buildStationWagon(PALETTE.teal), x: -6, z: STREET_GEOM.innerEdge + 7.0 },
      { build: () => buildMotorbike(PALETTE.pink), x: 6, z: STREET_GEOM.innerEdge + 5.2 },
    ];
    for (const spec of vehicleSpecs) {
      const vehicle = spec.build();
      vehicle.position.set(spec.x, 0, spec.z);
      vehicle.rotation.set(0, Math.PI, 0);
      vehicles.add(vehicle);
    }
    root.add(vehicles);

    // ---- Pedestrians on the sidewalk ----
    const pedestrians = new THREE.Group();
    pedestrians.name = 'pedestrians';
    const pedSlots: { x: number; z: number; variant: 'suit' | 'dress' | 'skirt' }[] = [
      { x: -40, z: BLOCK.depth / 2 + SIDEWALK.width + 0.6, variant: 'suit' },
      { x: -30, z: BLOCK.depth / 2 + SIDEWALK.width + 0.8, variant: 'dress' },
      { x: -20, z: BLOCK.depth / 2 + SIDEWALK.width + 0.5, variant: 'skirt' },
      { x: -8, z: BLOCK.depth / 2 + SIDEWALK.width + 0.9, variant: 'suit' },
      { x: 2, z: BLOCK.depth / 2 + SIDEWALK.width + 0.6, variant: 'dress' },
      { x: 14, z: BLOCK.depth / 2 + SIDEWALK.width + 0.7, variant: 'suit' },
      { x: 26, z: BLOCK.depth / 2 + SIDEWALK.width + 0.8, variant: 'skirt' },
      { x: 38, z: BLOCK.depth / 2 + SIDEWALK.width + 0.5, variant: 'dress' },
      { x: 48, z: BLOCK.depth / 2 + SIDEWALK.width + 0.9, variant: 'suit' },
      { x: -52, z: BLOCK.depth / 2 + SIDEWALK.width + 0.7, variant: 'skirt' },
    ];
    for (let i = 0; i < pedSlots.length; i++) {
      const slot = pedSlots[i];
      const outfit = OUTFITS[i % OUTFITS.length];
      const person = buildPedestrian(outfit, slot.variant);
      person.position.set(slot.x, 0, slot.z);
      pedestrians.add(person);
    }
    root.add(pedestrians);

    // ---- Street furniture: streetlights, bus stop, meters, phone, mailbox ----
    const furniture = new THREE.Group();
    furniture.name = 'furniture';

    const lightPositions = [
      { x: -50, z: STREET_GEOM.innerEdge + 1.4 },
      { x: -26, z: STREET_GEOM.innerEdge + 1.4 },
      { x: 2, z: STREET_GEOM.innerEdge + 1.4 },
      { x: 30, z: STREET_GEOM.innerEdge + 1.4 },
      { x: 54, z: STREET_GEOM.innerEdge + 1.4 },
    ];
    for (const p of lightPositions) {
      const light = buildStreetlight();
      light.name = 'streetlight';
      light.position.set(p.x, 0, p.z);
      furniture.add(light);
    }

    // Parking meters along the curb.
    const meterPositions = [-44, -32, -18, -6, 8, 22, 36, 50];
    for (const mx of meterPositions) {
      const meter = buildParkingMeter();
      meter.name = 'parking-meter';
      meter.position.set(mx, 0, STREET_GEOM.innerEdge - 0.4);
      furniture.add(meter);
    }

    // Bus stop.
    const busStop = buildBusStop();
    busStop.name = 'bus-stop';
    busStop.position.set(48, 0, BLOCK.depth / 2 + SIDEWALK.width + 0.8);
    furniture.add(busStop);

    // Phone booth.
    const phone = buildPhoneBooth();
    phone.name = 'phone-booth';
    phone.position.set(-52, 0, BLOCK.depth / 2 + SIDEWALK.width + 0.8);
    furniture.add(phone);

    // Mailbox.
    const mailbox = buildMailbox();
    mailbox.name = 'mailbox';
    mailbox.position.set(34, 0, BLOCK.depth / 2 + SIDEWALK.width + 0.9);
    furniture.add(mailbox);

    root.add(furniture);

    // ---- Interactive points (≥4) ----
    era1965.interactivePoints = makeInteractivePoints();

    // Store references for update/dispose.
    rootGroup = root;
    vehiclesGroup = vehicles;
    pedestriansGroup = pedestrians;
    disposed = false;
    clock = 0;
  },

  update(delta: number): void {
    if (disposed) {
      return;
    }
    clock += delta;

    // Gently bob the pedestrians to suggest walking.
    if (pedestriansGroup) {
      let i = 0;
      for (const child of pedestriansGroup.children) {
        child.position.y = Math.abs(Math.sin(clock * 2.0 + i * 0.7)) * 0.06;
        i++;
      }
    }

    // Drift the parked vehicles slightly (chrome glint / idle creep).
    if (vehiclesGroup) {
      let j = 0;
      for (const child of vehiclesGroup.children) {
        child.position.z = child.position.z + Math.sin(clock * 0.4 + j) * 0.001;
        j++;
      }
    }
  },

  dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    if (rootGroup) {
      rootGroup.removeFromParent();
    }
    rootGroup = null;
    vehiclesGroup = null;
    pedestriansGroup = null;
    era1965.interactivePoints = [];
  },
};

/**
 * Mesh providers handed to the simulation / main-integration on era switch.
 * Exposes the outfit variants and vehicle builders so the sim can spawn
 * animated extras consistent with the 1965 art direction.
 */
export const era1965Providers = Object.freeze({
  outfits: OUTFITS,
  vehicleBuilders: Object.freeze({
    sedan: buildSedan,
    stationWagon: buildStationWagon,
    motorbike: buildMotorbike,
  }),
  buildPedestrian,
});

// Register the era as a side effect of importing this module.
eraRegistry.registerEra(ERA_ID, era1965);