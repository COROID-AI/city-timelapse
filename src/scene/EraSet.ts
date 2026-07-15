import * as THREE from "three";
import type { EraVisualConfig, Interactable } from "../types";
import { SeededRNG, clamp } from "../utils/math";
import type { TextureSet } from "../utils/textures";
import { makeSignTexture } from "../utils/textures";

/**
 * Builds one era's worth of city-block content: buildings, vehicles,
 * pedestrians, props, and signage. Each EraSet is a self-contained Group whose
 * visibility/opacity is crossfaded by the SceneController during transitions.
 *
 * Geometry is shared across eras via the provided SharedAssets; only materials
 * and placements are era-specific. All CanvasTextures created here are owned
 * by this EraSet and disposed on teardown.
 */
export class EraSet {
  readonly root: THREE.Group;
  readonly interactables: Interactable[] = [];
  private readonly ownedTextures: THREE.Texture[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly animatedVehicles: VehicleAnim[] = [];
  private readonly pedestrians: PedMover[] = [];
  private readonly neonMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly shared: SharedAssets;

  constructor(
    private readonly config: EraVisualConfig,
    shared: SharedAssets
  ) {
    this.shared = shared;
    this.root = new THREE.Group();
    this.root.name = `era-${config.year}`;
    this.root.visible = false;
    this.build();
  }

  private build(): void {
    const rng = new SeededRNG(this.config.year * 7919 + 13);
    const c = this.config;

    // --- Buildings on both sides of the road ---
    const plotConfigs = [
      { x: -16, zmin: -54, zmax: -38 },
      { x: -16, zmin: -32, zmax: -12 },
      { x: -16, zmin: 6, zmax: 26 },
      { x: -16, zmin: 32, zmax: 52 },
      { x: 16, zmin: -54, zmax: -34 },
      { x: 16, zmin: -22, zmax: -2 },
      { x: 16, zmin: 10, zmax: 30 },
      { x: 16, zmin: 36, zmax: 52 },
    ];

    plotConfigs.forEach((plot, i) => {
      const floors = rng.int(c.buildingFloorsMin, c.buildingFloorsMax);
      const w = rng.range(7, 11);
      const d = plot.zmax - plot.zmin - rng.range(0, 3);
      const floorH = 3.2;
      const h = floors * floorH;
      const cx = plot.x;
      const cz = (plot.zmin + plot.zmax) / 2;
      const colorHex = c.buildingColors[i % c.buildingColors.length];
      this.makeBuilding(rng, cx, cz, w, d, h, floors, colorHex, i);
    });

    // --- Signage / storefronts ---
    this.makeSignage(rng);

    // --- Street props (lamps, etc.) ---
    this.makeProps(rng);

    // --- Vehicles ---
    this.makeVehicles(rng);

    // --- Pedestrians ---
    this.makePedestrians(rng);

    // --- Trees / foliage (era-dependent) ---
    this.makeFoliage(rng);
  }

  private makeBuilding(
    rng: SeededRNG,
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    floors: number,
    colorHex: number,
    idx: number
  ): void {
    const c = this.config;
    const isGlass = c.year >= 2005 && rng.chance(0.5);
    const facadeTex = isGlass
      ? this.shared.textures.glass
      : this.shared.textures.facades[idx % this.shared.textures.facades.length];

    const geo = this.shared.boxGeo.clone();
    geo.scale(w, h, d);
    this.ownedGeometries.push(geo);

    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: isGlass ? 0.12 : 0.82,
      metalness: isGlass ? 0.35 : 0.02,
      map: facadeTex,
    });
    this.ownedMaterials.push(mat);

    const bldg = new THREE.Mesh(geo, mat);
    bldg.position.set(cx, h / 2, cz);
    bldg.castShadow = true;
    bldg.receiveShadow = true;
    bldg.name = `building-${c.year}-${idx}`;
    this.root.add(bldg);

    // Roof detail
    const roofGeo = this.shared.boxGeo.clone();
    roofGeo.scale(w * 0.7, 0.6, d * 0.7);
    this.ownedGeometries.push(roofGeo);
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.9,
    });
    this.ownedMaterials.push(roofMat);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(cx, h + 0.3, cz);
    roof.castShadow = true;
    this.root.add(roof);

    // Neon emissive accents for night/era-specific
    if ((c.year === 1985 || c.year === 2055) && rng.chance(0.6)) {
      const stripGeo = this.shared.boxGeo.clone();
      stripGeo.scale(w * 0.96, 0.3, 0.3);
      this.ownedGeometries.push(stripGeo);
      const neonMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: c.accent,
        emissiveIntensity: 2.5,
        roughness: 0.4,
      });
      this.ownedMaterials.push(neonMat);
      this.neonMaterials.push(neonMat);
      for (let f = 1; f < floors; f += rng.int(2, 4)) {
        const strip = new THREE.Mesh(stripGeo, neonMat);
        const side = cx < 0 ? -1 : 1;
        strip.position.set(cx + side * (w / 2 + 0.16), f * 3.2, cz);
        this.root.add(strip);
      }
    }

    this.interactables.push({
      object: bldg,
      title: `${c.year} · ${rng.pick(BUILDING_LABELS)}`,
      body: c.facts.buildings,
    });
  }

  private makeSignage(rng: SeededRNG): void {
    const c = this.config;
    const signs = SIGN_DATA[c.year];
    if (!signs) return;
    signs.forEach((sd, i) => {
      const tex = makeSignTexture({
        text: sd.text,
        bg: sd.bg,
        fg: sd.fg,
        sub: sd.sub,
        neon: sd.neon,
        w: 256,
        h: 96,
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      this.ownedTextures.push(tex);

      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      this.ownedMaterials.push(mat);

      const w = sd.w ?? 4;
      const h = sd.h ?? 1.5;
      const geo = this.shared.planeGeo.clone();
      geo.scale(w, h, 1);
      this.ownedGeometries.push(geo);

      const sign = new THREE.Mesh(geo, mat);
      const side = i % 2 === 0 ? -1 : 1;
      sign.position.set(
        side * 10.4,
        sd.y ?? rng.range(4, 12),
        sd.z ?? rng.range(-40, 40)
      );
      sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      sign.name = `sign-${c.year}-${i}`;
      this.root.add(sign);

      // Emissive backing glow for neon signs.
      if (sd.neon) {
        const glowMat = new THREE.MeshBasicMaterial({
          color: sd.fg,
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide,
        });
        this.ownedMaterials.push(glowMat);
        const glowGeo = this.shared.planeGeo.clone();
        glowGeo.scale(w * 1.12, h * 1.3, 1);
        this.ownedGeometries.push(glowGeo);
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(sign.position);
        glow.rotation.copy(sign.rotation);
        glow.position.x += side * 0.05;
        this.root.add(glow);
      }

      this.interactables.push({
        object: sign,
        title: `${c.year} Signage`,
        body: c.facts.signage,
      });
    });
  }

  private makeProps(rng: SeededRNG): void {
    const c = this.config;
    const lampCount = 8;
    for (let i = 0; i < lampCount; i++) {
      const z = -54 + (i * 108) / (lampCount - 1);
      for (const side of [-1, 1]) {
        const lamp = this.makeLamp(rng, side * 5.6, z);
        this.root.add(lamp);
      }
    }

    // Era-specific extras
    if (c.year === 1985) {
      // Payphone booths
      for (let i = 0; i < 3; i++) {
        const booth = this.makeBox(
          rng.range(0.8, 0.9),
          2.0,
          rng.range(0.8, 0.9),
          0x224466,
          0.6
        );
        booth.position.set(5.8, 1.0, rng.range(-40, 40));
        this.root.add(booth);
        this.interactables.push({
          object: booth,
          title: `${c.year} · Payphone`,
          body: c.facts.props,
        });
      }
    }
    if (c.year === 2005 || c.year === 2025) {
      // Bike racks / scooter docks
      for (let i = 0; i < 4; i++) {
        const rack = this.makeBox(1.6, 0.5, 0.3, 0x888888, 0.4);
        rack.position.set(5.8, 0.25, rng.range(-50, 50));
        this.root.add(rack);
      }
    }
    if (c.year === 2055) {
      // Holographic light poles with floating glow orbs
      for (let i = 0; i < 6; i++) {
        const z = rng.range(-50, 50);
        const pole = this.makeLamp(rng, 5.8, z);
        this.root.add(pole);
        const holoMat = new THREE.MeshBasicMaterial({
          color: c.accent,
          transparent: true,
          opacity: 0.4,
        });
        this.ownedMaterials.push(holoMat);
        const holoGeo = this.shared.sphereGeo.clone();
        holoGeo.scale(1.2, 1.2, 1.2);
        this.ownedGeometries.push(holoGeo);
        const holo = new THREE.Mesh(holoGeo, holoMat);
        holo.position.set(5.8, 5, z);
        this.root.add(holo);
      }
    }
  }

  private makeLamp(_rng: SeededRNG, x: number, z: number): THREE.Group {
    const c = this.config;
    const g = new THREE.Group();

    // Pole
    const pole = this.makeBox(0.16, 5, 0.16, 0x2a2a2a, 0.7);
    pole.position.set(x, 2.5, z);
    g.add(pole);

    // Arm
    const arm = this.makeBox(1.0, 0.1, 0.1, 0x2a2a2a, 0.7);
    arm.position.set(x + (x < 0 ? 0.5 : -0.5), 4.95, z);
    g.add(arm);

    // Lamp head — emissive for night eras
    const headColor =
      c.year === 1945
        ? 0xffd29a
        : c.year === 2055
        ? c.accent
        : 0xfff0c0;
    const headMat = new THREE.MeshStandardMaterial({
      color: headColor,
      emissive: headColor,
      emissiveIntensity: c.year === 1945 ? 0.6 : c.year === 2055 ? 2.5 : 1.2,
      roughness: 0.5,
    });
    this.ownedMaterials.push(headMat);
    const headGeo = this.shared.sphereGeo.clone();
    headGeo.scale(0.25, 0.18, 0.25);
    this.ownedGeometries.push(headGeo);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(x + (x < 0 ? 1.0 : -1.0), 4.85, z);
    g.add(head);

    g.name = `lamp-${x.toFixed(1)}-${z.toFixed(1)}`;
    return g;
  }

  private makeVehicles(rng: SeededRNG): void {
    const c = this.config;
    const baseCount = Math.round(6 * c.density);
    const count = clamp(baseCount, 3, 10);

    for (let i = 0; i < count; i++) {
      const lane = i % 2 === 0 ? -1.8 : 1.8;
      const dir = lane < 0 ? 1 : -1;
      const z = rng.range(-60, 60);
      const color = rng.pick(c.vehicleColors);
      const v = this.makeVehicle(rng, color, dir);
      v.group.position.set(lane, 0.35, z);
      v.group.rotation.y = dir < 0 ? Math.PI : 0;
      this.root.add(v.group);
      this.animatedVehicles.push({
        group: v.group,
        speed: dir * rng.range(2, 5),
        wheels: v.wheels,
        hover: c.year === 2055,
      });
      this.interactables.push({
        object: v.group,
        title: `${c.year} · Vehicle`,
        body: c.facts.vehicles,
      });
    }
  }

  private makeVehicle(
    _rng: SeededRNG,
    color: number,
    _dir: number
  ): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const c = this.config;
    const g = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.35,
      metalness: 0.5,
    });
    this.ownedMaterials.push(bodyMat);

    if (c.year === 2055) {
      // Hovering pod
      const podGeo = this.shared.boxGeo.clone();
      podGeo.scale(2.0, 0.7, 3.6);
      this.ownedGeometries.push(podGeo);
      const pod = new THREE.Mesh(podGeo, bodyMat);
      pod.position.y = 0.3;
      pod.castShadow = true;
      g.add(pod);

      const glowMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: c.accent,
        emissiveIntensity: 3,
      });
      this.ownedMaterials.push(glowMat);
      const glowGeo = this.shared.sphereGeo.clone();
      glowGeo.scale(0.4, 0.15, 0.4);
      this.ownedGeometries.push(glowGeo);
      for (const dx of [-0.6, 0.6]) {
        for (const dz of [-1.2, 1.2]) {
          const glow = new THREE.Mesh(glowGeo, glowMat);
          glow.position.set(dx, 0.05, dz);
          g.add(glow);
        }
      }
    } else if (c.year <= 1965) {
      // Classic curvy car
      const bodyGeo = this.shared.boxGeo.clone();
      bodyGeo.scale(1.8, 0.7, 3.8);
      this.ownedGeometries.push(bodyGeo);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.2;
      body.castShadow = true;
      g.add(body);

      const cabinGeo = this.shared.boxGeo.clone();
      cabinGeo.scale(1.4, 0.6, 2.0);
      this.ownedGeometries.push(cabinGeo);
      const cabinMat = new THREE.MeshStandardMaterial({
        color: 0x222828,
        roughness: 0.2,
        metalness: 0.3,
      });
      this.ownedMaterials.push(cabinMat);
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 0.75, -0.2);
      g.add(cabin);

      // Fender bulges
      const fenderGeo = this.shared.sphereGeo.clone();
      fenderGeo.scale(0.5, 0.5, 0.65);
      this.ownedGeometries.push(fenderGeo);
      for (const dx of [-0.7, 0.7]) {
        for (const dz of [-1.2, 1.2]) {
          const f = new THREE.Mesh(fenderGeo, bodyMat);
          f.position.set(dx, 0.15, dz);
          f.castShadow = true;
          g.add(f);
        }
      }
      this.addWheels(g, wheels, 1.4, 0.3);
    } else {
      // Modern boxy car
      const bodyGeo = this.shared.boxGeo.clone();
      bodyGeo.scale(1.9, 0.65, 4.0);
      this.ownedGeometries.push(bodyGeo);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.25;
      body.castShadow = true;
      g.add(body);

      const cabinGeo = this.shared.boxGeo.clone();
      cabinGeo.scale(1.7, 0.58, 2.2);
      this.ownedGeometries.push(cabinGeo);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x111820,
        roughness: 0.1,
        metalness: 0.4,
      });
      this.ownedMaterials.push(glassMat);
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, 0.78, -0.1);
      g.add(cabin);

      this.addWheels(g, wheels, 1.5, 0.32);
    }

    return { group: g, wheels };
  }

  private addWheels(
    g: THREE.Group,
    wheels: THREE.Mesh[],
    track: number,
    r: number
  ): void {
    const wheelGeo = this.shared.cylGeo.clone();
    wheelGeo.rotateZ(Math.PI / 2);
    wheelGeo.scale(r, r, 0.18);
    this.ownedGeometries.push(wheelGeo);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.85,
    });
    this.ownedMaterials.push(wheelMat);
    for (const dx of [-track / 2, track / 2]) {
      for (const dz of [-1.3, 1.3]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(dx, r, dz);
        g.add(wheel);
        wheels.push(wheel);
      }
    }
  }

  private makePedestrians(rng: SeededRNG): void {
    const c = this.config;
    const baseCount = Math.round(14 * c.density);
    const count = clamp(baseCount, 4, 24);

    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const color = rng.pick(c.pedestrianColors);
      const ped = this.makePedestrian(rng, color);
      const x = side * rng.range(4.5, 6.2);
      const z = rng.range(-55, 55);
      ped.group.position.set(x, 0.14, z);
      ped.group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      ped.dir = side > 0 ? 1 : -1;
      this.root.add(ped.group);
      this.pedestrians.push({
        group: ped.group,
        speed: ped.dir * rng.range(0.6, 1.4),
        baseY: 0.14,
      });
      this.interactables.push({
        object: ped.group,
        title: `${c.year} · Pedestrian`,
        body: c.facts.pedestrians,
      });
    }
  }

  private makePedestrian(
    _rng: SeededRNG,
    color: number
  ): { group: THREE.Group; dir: number } {
    const c = this.config;
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.05,
    });
    this.ownedMaterials.push(bodyMat);

    // Torso
    const torsoGeo = this.shared.boxGeo.clone();
    torsoGeo.scale(0.32, 0.5, 0.2);
    this.ownedGeometries.push(torsoGeo);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.y = 0.55;
    torso.castShadow = true;
    g.add(torso);

    // Head
    const skin = c.year === 2055 ? c.accent : 0xc8a070;
    const headMat = new THREE.MeshStandardMaterial({
      color: skin,
      roughness: 0.6,
      emissive: c.year === 2055 ? c.accent : 0x000000,
      emissiveIntensity: c.year === 2055 ? 0.6 : 0,
    });
    this.ownedMaterials.push(headMat);
    const headGeo = this.shared.sphereGeo.clone();
    headGeo.scale(0.12, 0.14, 0.12);
    this.ownedGeometries.push(headGeo);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.95;
    g.add(head);

    // Legs
    const legGeo = this.shared.boxGeo.clone();
    legGeo.scale(0.1, 0.35, 0.1);
    this.ownedGeometries.push(legGeo);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.8,
    });
    this.ownedMaterials.push(legMat);
    for (const dx of [-0.08, 0.08]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(dx, 0.18, 0);
      g.add(leg);
    }

    return { group: g, dir: 1 };
  }

  private makeFoliage(rng: SeededRNG): void {
    const c = this.config;
    const density = c.year === 2025 ? 1.0 : c.year === 1945 ? 0.4 : 0.6;
    const count = Math.round(8 * density);
    for (let i = 0; i < count; i++) {
      const z = rng.range(-50, 50);
      const side = rng.chance(0.5) ? -1 : 1;
      const x = side * rng.range(5.5, 6.5);
      this.makeTree(x, z);
    }
  }

  private makeTree(x: number, z: number): void {
    const trunkGeo = this.shared.cylGeo.clone();
    trunkGeo.scale(0.12, 1.0, 0.12);
    this.ownedGeometries.push(trunkGeo);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a3020,
      roughness: 0.9,
    });
    this.ownedMaterials.push(trunkMat);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 0.5, z);
    trunk.castShadow = true;
    this.root.add(trunk);

    const leafGeo = this.shared.sphereGeo.clone();
    leafGeo.scale(0.8, 1.0, 0.8);
    this.ownedGeometries.push(leafGeo);
    const leafColor =
      this.config.year === 2055
        ? this.config.accent
        : this.config.year === 1985
        ? 0x3a4a2a
        : 0x4a6a3a;
    const leafMat = new THREE.MeshStandardMaterial({
      color: leafColor,
      roughness: 0.85,
      emissive: this.config.year === 2055 ? this.config.accent : 0x000000,
      emissiveIntensity: this.config.year === 2055 ? 0.4 : 0,
    });
    this.ownedMaterials.push(leafMat);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 1.5, z);
    leaves.castShadow = true;
    this.root.add(leaves);
  }

  /** A small helper to create a standalone box mesh with owned geometry. */
  private makeBox(
    w: number,
    h: number,
    d: number,
    color: number,
    rough: number
  ): THREE.Mesh {
    const geo = this.shared.boxGeo.clone();
    geo.scale(w, h, d);
    this.ownedGeometries.push(geo);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
    });
    this.ownedMaterials.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /** Advance vehicle and pedestrian motion. dt in seconds. */
  updateAnim(dt: number, time: number): void {
    for (const v of this.animatedVehicles) {
      v.group.position.z += v.speed * dt;
      if (v.group.position.z > 62) v.group.position.z = -62;
      else if (v.group.position.z < -62) v.group.position.z = 62;
      if (v.hover) {
        v.group.position.y = 0.35 + Math.sin(time * 2 + v.group.position.z) * 0.08;
      }
      for (let w = 0; w < v.wheels.length; w++) {
        v.wheels[w].rotation.x += v.speed * dt * 1.5;
      }
    }
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      p.group.position.z += p.speed * dt;
      if (p.group.position.z > 58) p.group.position.z = -58;
      else if (p.group.position.z < -58) p.group.position.z = 58;
      p.group.position.y = p.baseY + Math.abs(Math.sin(time * 4 + p.group.position.z)) * 0.04;
    }
    // Subtle neon pulse for night eras
    if (this.neonMaterials.length > 0) {
      const pulse = 2.0 + Math.sin(time * 1.5) * 0.6;
      for (let i = 0; i < this.neonMaterials.length; i++) {
        this.neonMaterials[i].emissiveIntensity = pulse;
      }
    }
  }

  /**
   * Set crossfade opacity/scale for this era set. `alpha` in [0,1]: 0 = fully
   * hidden, 1 = fully visible. Uses material opacity for transparent fade and
   * a slight scale to feel like a "dissolve."
   */
  setCrossfade(alpha: number): void {
    const visible = alpha > 0.001;
    this.root.visible = visible;
    if (!visible) return;
    const s = 0.92 + alpha * 0.08;
    this.root.scale.setScalar(s);
    // Walk all materials; set transparent + opacity. This is set once per
    // transition frame, not per draw call, and only for the 2 active sets.
    const transparent = alpha < 0.999;
    for (let i = 0; i < this.ownedMaterials.length; i++) {
      const mat = this.ownedMaterials[i];
      const wasTransparent = mat.transparent;
      mat.transparent = transparent;
      mat.opacity = alpha;
      // Only request shader recompile when the transparent flag actually
      // changes, avoiding needless per-frame recompiles.
      if (wasTransparent !== transparent) mat.needsUpdate = true;
    }
  }

  dispose(): void {
    for (let i = 0; i < this.ownedGeometries.length; i++) {
      this.ownedGeometries[i].dispose();
    }
    for (let i = 0; i < this.ownedMaterials.length; i++) {
      this.ownedMaterials[i].dispose();
    }
    for (let i = 0; i < this.ownedTextures.length; i++) {
      this.ownedTextures[i].dispose();
    }
    this.interactables.length = 0;
    this.animatedVehicles.length = 0;
    this.pedestrians.length = 0;
    this.neonMaterials.length = 0;
  }
}

interface VehicleAnim {
  group: THREE.Group;
  speed: number;
  wheels: THREE.Mesh[];
  hover: boolean;
}

interface PedMover {
  group: THREE.Group;
  speed: number;
  baseY: number;
}

/**
 * Shared, immutable geometry + textures used by all EraSets. Geometries here
 * are the base unit primitives; each EraSet clones + scales them (the clone
 * owns its scaled copy and disposes it on teardown).
 */
export interface SharedAssets {
  readonly boxGeo: THREE.BoxGeometry;
  readonly cylGeo: THREE.CylinderGeometry;
  readonly sphereGeo: THREE.SphereGeometry;
  readonly planeGeo: THREE.PlaneGeometry;
  readonly textures: TextureSet;
}

export function createSharedAssets(textures: TextureSet): SharedAssets {
  return {
    boxGeo: new THREE.BoxGeometry(1, 1, 1),
    cylGeo: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
    sphereGeo: new THREE.SphereGeometry(0.5, 16, 12),
    planeGeo: new THREE.PlaneGeometry(1, 1),
    textures,
  };
}

export function disposeSharedAssets(assets: SharedAssets): void {
  assets.boxGeo.dispose();
  assets.cylGeo.dispose();
  assets.sphereGeo.dispose();
  assets.planeGeo.dispose();
}

// ---------------------------------------------------------------------------
// Static data tables
// ---------------------------------------------------------------------------

const BUILDING_LABELS = [
  "Corner Brownstone",
  "Office Tower",
  "Apartment Block",
  "Shopfront Row",
  "Glass High-Rise",
  "Brick Walk-Up",
  "Curtain-Wall Tower",
  "Megatower Spire",
] as const;

interface SignDatum {
  text: string;
  bg: string;
  fg: string;
  sub?: string;
  neon?: boolean;
  w?: number;
  h?: number;
  y?: number;
  z?: number;
}

const SIGN_DATA: Record<number, SignDatum[]> = {
  1945: [
    { text: "BAKERY", bg: "#5a4630", fg: "#e8d0a0", sub: "Fresh Daily" },
    { text: "CINEMA", bg: "#3a2a1a", fg: "#ffce6a", sub: "Now Showing" },
    { text: "TAILOR", bg: "#4a3a28", fg: "#d8c090" },
  ],
  1965: [
    { text: "DINER", bg: "#b03030", fg: "#ffffff", sub: "Open 24hr" },
    { text: "RADIO", bg: "#3040b0", fg: "#ffe040", sub: "Transistors!" },
    { text: "DRIVE-IN", bg: "#1a3a2a", fg: "#ff8a5a" },
  ],
  1985: [
    { text: "ARCADE", bg: "#1a0a2a", fg: "#ff3a8a", neon: true, sub: "INSERT COIN" },
    { text: "VIDEO", bg: "#0a1a2a", fg: "#40d0ff", neon: true },
    { text: "NEON", bg: "#2a0a1a", fg: "#ffd040", neon: true },
  ],
  2005: [
    { text: "CAFE", bg: "#2a3a4a", fg: "#ffffff", sub: "WiFi Here" },
    { text: "MOBILES", bg: "#1a2a3a", fg: "#3aa0ff", sub: "3G Speed" },
    { text: "DOT COM", bg: "#2a2a2a", fg: "#ffffff", sub: "Online Now" },
  ],
  2025: [
    { text: "ECO", bg: "#2a4a3a", fg: "#40e0a0", sub: "Sustainable" },
    { text: "STREAM", bg: "#1a1a2a", fg: "#e040a0", sub: "On Demand" },
    { text: "EATS", bg: "#3a3a2a", fg: "#ffce6a", sub: "Delivery" },
  ],
  2055: [
    { text: "AI", bg: "#0a1a2a", fg: "#33ddff", neon: true, sub: "Concierge" },
    { text: "ORBIT", bg: "#1a0a2a", fg: "#ff4ad0", neon: true, sub: "Mars Tours" },
    { text: "NEXUS", bg: "#0a2a2a", fg: "#aaffff", neon: true },
  ],
};
