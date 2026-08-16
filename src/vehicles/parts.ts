// ─── Shared Car Parts Builder ────────────────────────────────────────
// Reusable geometry builders for era-correct vehicle components.
// All materials are procedural (no external assets).

import * as THREE from 'three';
import type { EraId } from '../eras.js';

// ── Color palettes per era ──────────────────────────────────────────

const ERA_COLORS: Record<EraId, { body: number[]; accent: number[]; chrome: number }> = {
  '1945': {
    body: [0x2d2a1e, 0x3a3528, 0x4a4436, 0x1c1b17], // drab olive, dark grey, military green
    accent: [0x555555],
    chrome: 0x888888, // dull wartime metal (rationing)
  },
  '1965': {
    body: [0xcc2200, 0x0033aa, 0xfaf0e6, 0xffcc00, 0x006644], // vibrant post-war colors
    accent: [0xffffff, 0xdddddd],
    chrome: 0xeeeeee, // bright chrome
  },
  '1985': {
    body: [0xeeeeee, 0x222222, 0xcc3333, 0x336699, 0xffff00], // boxy era palette
    accent: [0x111111],
    chrome: 0xaaaaaa,
  },
  '2005': {
    body: [0xf5f5dc, 0xc0c0c0, 0x333333, 0xffcc00, 0x6699cc, 0xcc4444], // SUV/taxi yellows
    accent: [0x222222],
    chrome: 0xbbbbbb,
  },
  '2025': {
    body: [0xffffff, 0x111111, 0x00aaff, 0x00cc88, 0x888888, 0x2244aa], // EV whites/blues/greens
    accent: [0x00ffcc],
    chrome: 0x333333, // matte black accents
  },
};

function pickColor<T extends number[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Wheel builder ────────────────────────────────────────────────────

export function createWheel(radius = 0.35, width = 0.2, era: EraId): THREE.Mesh {
  const group = new THREE.Group();

  // Tire (torus)
  const tireGeo = new THREE.TorusGeometry(radius, width / 2, 8, 16);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.rotation.y = Math.PI / 2;
  group.add(tire);

  // Hubcap — era-specific
  const hubRadius = radius * 0.55;
  let hubGeo: THREE.BufferGeometry;

  switch (era) {
    case '1945':
      // Simple solid disc hubcap
      hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius, width * 0.6, 12);
      break;
    case '1965':
      // Chrome star pattern hubcap
      hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius, width * 0.6, 16);
      break;
    case '1985':
      // Plastic hubcap with basic rim
      hubGeo = new THREE.CylinderGeometry(hubRadius * 0.7, hubRadius * 0.7, width * 0.5, 8);
      break;
    case '2005':
      // Alloy wheel style
      hubGeo = new THREE.CylinderGeometry(hubRadius * 0.6, hubRadius * 0.6, width * 0.4, 10);
      break;
    case '2025':
      // Aerodynamic closed hubcap
      hubGeo = new THREE.CylinderGeometry(hubRadius * 0.8, hubRadius * 0.8, width * 0.3, 12);
      break;
  }

  const hubColors = {
    '1945': 0x666666,
    '1965': 0xeeeeee,
    '1985': 0x999999,
    '2005': 0xcccccc,
    '2025': 0x444444,
  };

  const hubMat = new THREE.MeshStandardMaterial({
    color: hubColors[era],
    roughness: era === '1965' ? 0.1 : 0.5,
    metalness: era === '1965' ? 0.9 : 0.3,
  });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  return group as unknown as THREE.Mesh;
}

export function createWheelPair(era: EraId): THREE.Group {
  const pair = new THREE.Group();
  const left = createWheel(0.35, 0.2, era);
  const right = createWheel(0.35, 0.2, era);
  left.position.set(-0.75, -0.35, 0);
  right.position.set(0.75, -0.35, 0);
  pair.add(left as any);
  pair.add(right as any);
  return pair;
}

// ── Headlight builder ────────────────────────────────────────────────

export function createHeadlights(era: EraId, side: 'front' | 'back'): THREE.Group {
  const lights = new THREE.Group();
  const isFront = side === 'front';

  const headlightConfigs: Record<EraId, { shape: string; emissive: number; size: [number, number] }> = {
    '1945': { shape: 'round', emissive: 0xfff4cc, size: [0.25, 0.25] },
    '1965': { shape: 'round', emissive: 0xfff8e0, size: [0.3, 0.3] },
    '1985': { shape: 'sealed_beam', emissive: 0xfff0d0, size: [0.35, 0.35] },
    '2005': { shape: 'rectangular', emissive: 0xffffee, size: [0.45, 0.25] },
    '2025': { shape: 'led_bar', emissive: 0xaaddff, size: [0.6, 0.08] },
  };

  const cfg = headlightConfigs[era];

  for (const xPos of [-0.6, 0.6]) {
    let lightMesh: THREE.Mesh;
    let housing: THREE.Mesh | null = null;

    switch (cfg.shape) {
      case 'round': {
        // Classic round sealed beam
        const lensGeo = new THREE.CircleGeometry(cfg.size[0] / 2, 16);
        const lensMat = new THREE.MeshStandardMaterial({
          color: cfg.emissive,
          emissive: isFront ? cfg.emissive : 0xff2200,
          emissiveIntensity: isFront ? 0.8 : 0.5,
          roughness: 0.2,
          metalness: 0.1,
          transparent: true,
          opacity: 0.9,
        });
        lightMesh = new THREE.Mesh(lensGeo, lensMat);

        // Housing ring
        const ringGeo = new THREE.RingGeometry(cfg.size[0] / 2, cfg.size[0] / 2 + 0.04, 16);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 });
        housing = new THREE.Mesh(ringGeo, ringMat);
        break;
      }
      case 'sealed_beam': {
        // Square sealed beam (1985 style)
        const s = cfg.size[0];
        const lensGeo = new THREE.PlaneGeometry(s, s);
        const lensMat = new THREE.MeshStandardMaterial({
          color: cfg.emissive,
          emissive: isFront ? cfg.emissive : 0xff2200,
          emissiveIntensity: isFront ? 0.7 : 0.5,
          roughness: 0.3,
          metalness: 0.0,
          transparent: true,
          opacity: 0.85,
        });
        lightMesh = new THREE.Mesh(lensGeo, lensMat);

        // Frame
        const frameGeo = new THREE.BoxGeometry(s + 0.08, s + 0.08, 0.02);
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
        housing = new THREE.Mesh(frameGeo, frameMat);
        break;
      }
      case 'rectangular': {
        // Angular 2005 headlights
        const w = cfg.size[0];
        const h = cfg.size[1];
        const lensGeo = new THREE.PlaneGeometry(w, h);
        const lensMat = new THREE.MeshStandardMaterial({
          color: cfg.emissive,
          emissive: isFront ? cfg.emissive : 0xff2200,
          emissiveIntensity: isFront ? 0.6 : 0.5,
          roughness: 0.15,
          metalness: 0.2,
          transparent: true,
          opacity: 0.9,
        });
        lightMesh = new THREE.Mesh(lensGeo, lensMat);

        // Sleek housing
        const housingGeo = new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.03);
        const housingMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
        housing = new THREE.Mesh(housingGeo, housingMat);
        break;
      }
      case 'led_bar': {
        // 2025 LED light bar
        const barLen = cfg.size[0];
        const barW = cfg.size[1];

        if (isFront) {
          // Full-width LED strip across front
          const barGeo = new THREE.BoxGeometry(barLen, barW, 0.03);
          const barMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xaaddff,
            emissiveIntensity: 1.5,
            roughness: 0.1,
            metalness: 0.0,
            transparent: true,
            opacity: 0.95,
          });
          lightMesh = new THREE.Mesh(barGeo, barMat);
          housing = lightMesh.clone();
          housing.material = new THREE.MeshStandardMaterial({
            color: 0x111111, roughness: 0.3, metalness: 0.5,
          });
          break;
        } else {
          // LED taillight bar
          const tailGeo = new THREE.BoxGeometry(barLen, barW * 3, 0.03);
          const tailMat = new THREE.MeshStandardMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 1.0,
            roughness: 0.2,
            metalness: 0.0,
            transparent: true,
            opacity: 0.9,
          });
          lightMesh = new THREE.Mesh(tailGeo, tailMat);
          housing = lightMesh.clone();
          housing.material = new THREE.MeshStandardMaterial({
            color: 0x111111, roughness: 0.3, metalness: 0.5,
          });
          break;
        }
      }
      default:
        continue;
    }

    lightMesh.position.set(xPos, 0, 0.01);
    lights.add(lightMesh);
    if (housing) {
      housing.position.set(xPos, 0, -0.01);
      lights.add(housing);
    }
  }

  return lights;
}

// ── Bumper builder ───────────────────────────────────────────────────

export function createBumper(era: EraId, side: 'front' | 'back'): THREE.Mesh {
  const width = 1.6;
  const height = 0.25;
  const depth = 0.12;

  let bumperGeo: THREE.BufferGeometry;
  let bumperMat: THREE.Material;
  const isFront = side === 'front';

  switch (era) {
    case '1945': {
      // Tall, narrow, utilitarian bumper
      bumperGeo = new THREE.BoxGeometry(width, height * 0.7, depth);
      bumperMat = new THREE.MeshStandardMaterial({
        color: isFront ? 0x555555 : 0x444444,
        roughness: 0.7,
        metalness: 0.4,
      });
      break;
    }
    case '1965': {
      // Long chrome bumper with overriders
      bumperGeo = new THREE.BoxGeometry(width + 0.2, height * 0.5, depth * 1.5);
      bumperMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeee,
        roughness: 0.05,
        metalness: 0.95,
      });
      break;
    }
    case '1985': {
      // Rubber-molded impact bumper
      bumperGeo = new THREE.BoxGeometry(width, height, depth);
      bumperMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.9,
        metalness: 0.0,
      });
      break;
    }
    case '2005': {
      // Body-colored integrated bumper
      bumperGeo = new THREE.BoxGeometry(width + 0.1, height * 0.8, depth * 1.2);
      bumperMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.5,
        metalness: 0.2,
      });
      break;
    }
    case '2025': {
      // Smooth aerodynamic bumper with sensor cutouts
      bumperGeo = new THREE.BoxGeometry(width, height * 0.7, depth);
      bumperMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.4,
        metalness: 0.3,
      });
      break;
    }
    default:
      bumperGeo = new THREE.BoxGeometry(width, height, depth);
      bumperMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.3 });
  }

  return new THREE.Mesh(bumperGeo, bumperMat);
}

// ── Mirror builder ───────────────────────────────────────────────────

export function createMirrors(era: EraId): THREE.Group {
  const mirrors = new THREE.Group();

  const mirrorSize = era === '1965' ? 0.12 : era === '2025' ? 0.08 : 0.1;

  for (const xDir of [-1, 1]) {
    const mount = new THREE.Group();

    // Arm
    const armGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = 0.1;
    mount.add(arm);

    // Mirror housing
    const housingGeo = era === '1985' || era === '2005'
      ? new THREE.BoxGeometry(0.1, 0.08, 0.06)
      : new THREE.SphereGeometry(mirrorSize, 8, 6);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5 });
    const housing = new THREE.Mesh(housingGeo, housingMat);
    housing.position.x = 0.2;
    mount.add(housing);

    // Glass
    const glassGeo = new THREE.PlaneGeometry(0.06, 0.05);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc,
      metalness: 0.9,
      roughness: 0.1,
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0.2, 0, 0.035);
    mount.add(glass);

    mount.position.set(xDir * 0.8, 0.6, 0);
    mirrors.add(mount);
  }

  return mirrors;
}

// ── Chassis builder ──────────────────────────────────────────────────

export function createChassis(era: EraId, type: 'sedan' | 'truck' | 'suv' | 'hatchback' | 'trolley'): THREE.Group {
  const chassis = new THREE.Group();
  const bodyColor = pickColor(ERA_COLORS[era].body);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: era === '1965' ? 0.2 : 0.5,
    metalness: era === '1965' ? 0.3 : 0.1,
  });

  switch (type) {
    case 'sedan': {
      // Main body (rounded lower section)
      const lowerBody = new THREE.BoxGeometry(1.8, 0.5, 4.0);
      const lowerMesh = new THREE.Mesh(lowerBody, bodyMat);
      lowerMesh.position.y = 0.45;
      chassis.add(lowerMesh);

      // Hood (angled up front)
      const hoodGeo = new THREE.BoxGeometry(1.6, 0.15, 1.2);
      const hood = new THREE.Mesh(hoodGeo, bodyMat);
      hood.position.set(0, 0.85, 1.3);
      hood.rotation.x = -0.15;
      chassis.add(hood);

      // Trunk deck
      const trunkGeo = new THREE.BoxGeometry(1.5, 0.12, 0.9);
      const trunk = new THREE.Mesh(trunkGeo, bodyMat);
      trunk.position.set(0, 0.85, -1.3);
      chassis.add(trunk);

      // Roof line (low)
      const roofGeo = new THREE.BoxGeometry(1.4, 0.1, 1.6);
      const roof = new THREE.Mesh(roofGeo, bodyMat);
      roof.position.set(0, 1.0, -0.1);
      chassis.add(roof);

      // Windshield
      const wsGeo = new THREE.PlaneGeometry(1.3, 0.7);
      const wsMat = new THREE.MeshStandardMaterial({
        color: 0x88bbdd,
        transparent: true,
        opacity: 0.4,
        roughness: 0.0,
        metalness: 0.3,
      });
      const windshield = new THREE.Mesh(wsGeo, wsMat);
      windshield.position.set(0, 0.85, 0.55);
      windshield.rotation.x = -0.35;
      chassis.add(windshield);

      // Rear window
      const rw = new THREE.Mesh(wsGeo, wsMat);
      rw.position.set(0, 0.85, -0.85);
      rw.rotation.x = 0.35;
      chassis.add(rw);

      break;
    }
    case 'truck': {
      // Flat-bed or delivery truck body
      const cabGeo = new THREE.BoxGeometry(1.8, 0.8, 1.5);
      const cab = new THREE.Mesh(cabGeo, bodyMat);
      cab.position.set(0, 0.7, 1.0);
      chassis.add(cab);

      // Cargo area
      const cargoGeo = new THREE.BoxGeometry(1.7, 1.2, 2.2);
      const cargo = new THREE.Mesh(cargoGeo, bodyMat);
      cargo.position.set(0, 0.9, -0.7);
      chassis.add(cargo);

      // Cargo walls
      const wallGeo = new THREE.PlaneGeometry(2.2, 1.2);
      const wallMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 });
      const backWall = new THREE.Mesh(wallGeo, wallMat);
      backWall.position.set(0, 1.0, -1.8);
      backWall.rotation.y = Math.PI;
      chassis.add(backWall);

      // Cab windshield
      const wsGeo = new THREE.PlaneGeometry(1.5, 0.6);
      const wsMat = new THREE.MeshStandardMaterial({
        color: 0x88bbdd, transparent: true, opacity: 0.35,
      });
      const ws = new THREE.Mesh(wsGeo, wsMat);
      ws.position.set(0, 1.0, 1.75);
      ws.rotation.x = -0.2;
      chassis.add(ws);

      break;
    }
    case 'suv': {
      // Taller, boxier body
      const bodyGeo = new THREE.BoxGeometry(1.9, 0.8, 4.2);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.65;
      chassis.add(body);

      // Roof rack (2005+)
      if (era === '2005' || era === '2025') {
        const rackMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
        for (const z of [-0.3, 0.3]) {
          const railGeo = new THREE.BoxGeometry(1.6, 0.03, 2.0);
          const rail = new THREE.Mesh(railGeo, rackMat);
          rail.position.set(0, 1.15, z);
          chassis.add(rail);
        }
        // Cross bars
        for (const x of [-0.6, 0, 0.6]) {
          const crossGeo = new THREE.BoxGeometry(0.03, 0.03, 2.0);
          const cross = new THREE.Mesh(crossGeo, rackMat);
          cross.position.set(x, 1.15, 0);
          chassis.add(cross);
        }
      }

      // Sloped rear
      const rearGeo = new THREE.BoxGeometry(1.8, 0.6, 0.3);
      const rear = new THREE.Mesh(rearGeo, bodyMat);
      rear.position.set(0, 0.9, -2.0);
      rear.rotation.x = 0.3;
      chassis.add(rear);

      // Large windows
      const wsGeo = new THREE.PlaneGeometry(1.6, 0.55);
      const wsMat = new THREE.MeshStandardMaterial({
        color: 0x88bbdd, transparent: true, opacity: 0.35,
      });
      const ws = new THREE.Mesh(wsGeo, wsMat);
      ws.position.set(0, 0.9, 0.8);
      ws.rotation.x = -0.25;
      chassis.add(ws);

      break;
    }
    case 'hatchback': {
      // Boxy 1980s shape
      const bodyGeo = new THREE.BoxGeometry(1.6, 0.6, 3.6);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.5;
      chassis.add(body);

      // Flat roof
      const roofGeo = new THREE.BoxGeometry(1.5, 0.08, 1.8);
      const roof = new THREE.Mesh(roofGeo, bodyMat);
      roof.position.set(0, 0.85, -0.1);
      chassis.add(roof);

      // Vertical rear hatch
      const hatchGeo = new THREE.BoxGeometry(1.5, 0.7, 0.15);
      const hatch = new THREE.Mesh(hatchGeo, bodyMat);
      hatch.position.set(0, 0.7, -1.8);
      chassis.add(hatch);

      // Roof rack (1985 signature)
      const rackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
      for (const _z of [-0.2, 0.2]) {
        const railGeo = new THREE.BoxGeometry(1.3, 0.02, 1.4);
        const rail = new THREE.Mesh(railGeo, rackMat);
        rail.position.set(0, 0.9, -0.1);
        chassis.add(rail);
      }
      for (const x of [-0.4, 0, 0.4]) {
        const crossGeo = new THREE.BoxGeometry(0.02, 0.02, 1.4);
        const cross = new THREE.Mesh(crossGeo, rackMat);
        cross.position.set(x, 0.9, -0.1);
        chassis.add(cross);
      }

      // Angled windshield
      const wsGeo = new THREE.PlaneGeometry(1.3, 0.55);
      const wsMat = new THREE.MeshStandardMaterial({
        color: 0x88bbdd, transparent: true, opacity: 0.35,
      });
      const ws = new THREE.Mesh(wsGeo, wsMat);
      ws.position.set(0, 0.8, 0.7);
      ws.rotation.x = -0.3;
      chassis.add(ws);

      break;
    }
    case 'trolley': {
      // Vintage streetcar/trolley shape
      const bodyGeo = new THREE.BoxGeometry(1.6, 1.2, 5.0);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1.0;
      chassis.add(body);

      // Rounded front end (war-era trolley)
      const frontGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.3, 12, 1, false, 0, Math.PI);
      const front = new THREE.Mesh(frontGeo, bodyMat);
      front.rotation.y = Math.PI / 2;
      front.rotation.z = Math.PI / 2;
      front.position.set(0, 1.0, 2.65);
      chassis.add(front);

      // Top dome/roof
      const domeGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.3, 12, 1, false, 0, Math.PI);
      const dome = new THREE.Mesh(domeGeo, bodyMat);
      dome.rotation.y = Math.PI / 2;
      dome.rotation.z = Math.PI / 2;
      dome.position.set(0, 1.7, 0);
      chassis.add(dome);

      // Windows along sides
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x88bbdd, transparent: true, opacity: 0.4,
      });
      for (let i = -2; i <= 2; i++) {
        const winGeo = new THREE.PlaneGeometry(0.6, 0.5);
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(0.81, 1.1, i * 0.9);
        win.rotation.y = Math.PI / 2;
        chassis.add(win);
        const winL = win.clone();
        winL.position.x = -0.81;
        winL.rotation.y = -Math.PI / 2;
        chassis.add(winL);
      }

      // Trolley pole on top
      const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.5, 4);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(0, 2.3, -0.5);
      chassis.add(pole);

      break;
    }
  }

  return chassis;
}

// ── Cabin builder (windows + roof) ──────────────────────────────────

export function createCabin(_era: EraId, type: 'sedan' | 'truck' | 'suv' | 'hatchback' | 'trolley'): THREE.Group {
  const cabin = new THREE.Group();
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x88bbdd,
    transparent: true,
    opacity: 0.3,
    roughness: 0.0,
    metalness: 0.3,
  });

  switch (type) {
    case 'sedan': {
      // Side windows
      const sideWinGeo = new THREE.PlaneGeometry(1.2, 0.5);
      for (const xDir of [-1, 1]) {
        const sw = new THREE.Mesh(sideWinGeo, glassMat);
        sw.position.set(xDir * 0.81, 0.75, 0.0);
        sw.rotation.y = xDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        cabin.add(sw);
      }
      break;
    }
    case 'suv': {
      const sideWinGeo = new THREE.PlaneGeometry(1.4, 0.55);
      for (const xDir of [-1, 1]) {
        const sw = new THREE.Mesh(sideWinGeo, glassMat);
        sw.position.set(xDir * 0.96, 0.9, 0.0);
        sw.rotation.y = xDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        cabin.add(sw);
      }
      break;
    }
    case 'hatchback': {
      const sideWinGeo = new THREE.PlaneGeometry(1.1, 0.45);
      for (const xDir of [-1, 1]) {
        const sw = new THREE.Mesh(sideWinGeo, glassMat);
        sw.position.set(xDir * 0.81, 0.7, 0.0);
        sw.rotation.y = xDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        cabin.add(sw);
      }
      break;
    }
  }

  return cabin;
}

// ── Complete vehicle assembly helper ─────────────────────────────────

export function assembleVehicle(
  era: EraId,
  type: 'sedan' | 'truck' | 'suv' | 'hatchback' | 'trolley',
): THREE.Group {
  const vehicle = new THREE.Group();

  const chassis = createChassis(era, type);
  vehicle.add(chassis);

  const cabin = createCabin(era, type);
  vehicle.add(cabin);

  const wheelsFL = createWheel(0.35, 0.2, era);
  wheelsFL.position.set(-0.75, -0.35, 1.2);
  vehicle.add(wheelsFL as any);

  const wheelsFR = createWheel(0.35, 0.2, era);
  wheelsFR.position.set(0.75, -0.35, 1.2);
  vehicle.add(wheelsFR as any);

  const wheelsRL = createWheel(0.35, 0.2, era);
  wheelsRL.position.set(-0.75, -0.35, -1.2);
  vehicle.add(wheelsRL as any);

  const wheelsRR = createWheel(0.35, 0.2, era);
  wheelsRR.position.set(0.75, -0.35, -1.2);
  vehicle.add(wheelsRR as any);

  const frontLights = createHeadlights(era, 'front');
  frontLights.position.set(0, 0.6, 2.01);
  vehicle.add(frontLights);

  const rearLights = createHeadlights(era, 'back');
  rearLights.position.set(0, 0.6, -2.01);
  vehicle.add(rearLights);

  const frontBumper = createBumper(era, 'front');
  frontBumper.position.set(0, 0.3, 2.05);
  vehicle.add(frontBumper);

  const rearBumper = createBumper(era, 'back');
  rearBumper.position.set(0, 0.3, -2.05);
  vehicle.add(rearBumper);

  const mirrors = createMirrors(era);
  vehicle.add(mirrors);

  return vehicle;
}

// ── E-scooter builder (2025 micromobility) ──────────────────────────

export function createEScooter(): THREE.Group {
  const scooter = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x00cc88, roughness: 0.4, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });

  // Deck
  const deckGeo = new THREE.BoxGeometry(0.25, 0.03, 0.8);
  const deck = new THREE.Mesh(deckGeo, darkMat);
  deck.position.y = 0.25;
  scooter.add(deck);

  // Stem
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6);
  const stem = new THREE.Mesh(stemGeo, frameMat);
  stem.position.set(0, 0.6, -0.3);
  stem.rotation.x = -0.15;
  scooter.add(stem);

  // Handlebar
  const hbGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6);
  const hb = new THREE.Mesh(hbGeo, darkMat);
  hb.rotation.z = Math.PI / 2;
  hb.position.set(0, 0.95, -0.35);
  scooter.add(hb);

  // Wheels
  for (const z of [-0.3, 0.3]) {
    const wheelGeo = new THREE.TorusGeometry(0.12, 0.03, 6, 12);
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, 0.12, z);
    scooter.add(wheel);
  }

  return scooter;
}

// ── E-bike builder (2025 micromobility) ─────────────────────────────

export function createEBike(): THREE.Group {
  const bike = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x00aaff, roughness: 0.3, metalness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });

  // Frame triangle
  const tubeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6);

  const topTube = new THREE.Mesh(tubeGeo, frameMat);
  topTube.rotation.z = Math.PI / 2;
  topTube.position.set(0, 0.55, 0);
  bike.add(topTube);

  const downTube = new THREE.Mesh(tubeGeo, frameMat);
  downTube.position.set(0, 0.45, -0.15);
  downTube.rotation.x = 0.6;
  bike.add(downTube);

  const seatTube = new THREE.Mesh(tubeGeo, frameMat);
  seatTube.position.set(-0.15, 0.5, 0.15);
  seatTube.rotation.x = -0.4;
  bike.add(seatTube);

  // Seat post & seat
  const spGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.15, 4);
  const sp = new THREE.Mesh(spGeo, darkMat);
  sp.position.set(-0.2, 0.65, 0.2);
  bike.add(sp);

  const seatGeo = new THREE.BoxGeometry(0.15, 0.02, 0.2);
  const seat = new THREE.Mesh(seatGeo, darkMat);
  seat.position.set(-0.2, 0.73, 0.2);
  bike.add(seat);

  // Handlebars
  const handleBarGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.35, 6);
  const handleBar = new THREE.Mesh(handleBarGeo, darkMat);
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0.15, 0.7, -0.25);
  bike.add(handleBar);

  // Fork
  const forkGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.35, 6);
  const fork = new THREE.Mesh(forkGeo, frameMat);
  fork.position.set(0.15, 0.45, -0.3);
  fork.rotation.x = -0.1;
  bike.add(fork);

  // Wheels
  for (const z of [-0.35, 0.35]) {
    const wheelGeo = new THREE.TorusGeometry(0.2, 0.02, 6, 16);
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0.15, 0.2, z);
    bike.add(wheel);
  }

  return bike;
}
