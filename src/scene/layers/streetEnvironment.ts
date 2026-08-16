/**
 * Street environment layer factory.
 *
 * Creates a Three.js Group containing road surface, sidewalk,
 * crosswalk markings, lamp posts, and era-specific street furniture.
 * All props are built procedurally from Three.js primitives and canvas textures.
 */

import * as THREE from 'three';
import type { EraContent } from '../../content/eraConfig.js';
import type { EraId } from '../../eras.js';

// ─── Result interface ──────────────────────────────────────────────────────

export interface StreetEnvironmentResult {
  group: THREE.Group;
  applyEra: (eraId: EraId) => void;
}

// ─── Helper: create canvas texture ─────────────────────────────────────────

function createCanvasTexture(
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  drawFn(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ─── Surface creation helpers ──────────────────────────────────────────────

function createRoadSurface(config: EraContent['street']): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(60, config.roadWidth);

  let texture: THREE.CanvasTexture | null = null;
  let mat: THREE.MeshStandardMaterial;

  switch (config.surfaceMaterial) {
    case 'cobblestone': {
      texture = createCanvasTexture(512, 512, (ctx) => {
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 32) {
          for (let x = 0; x < 512; x += 40) {
            const offset = (Math.floor(y / 32) % 2) * 20;
            const variation = Math.random() * 30 - 15;
            const r = 58 + variation;
            const g = 55 + variation;
            const b = 50 + variation;
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x + offset + 1, y + 1, 38, 30);
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + offset, y, 40, 32);
          }
        }
        for (let i = 0; i < 20; i++) {
          ctx.fillStyle = `rgba(30,30,30,${Math.random() * 0.3})`;
          ctx.beginPath();
          ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 20 + 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0.0 });
      break;
    }
    case 'asphalt': {
      texture = createCanvasTexture(512, 512, (ctx) => {
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 5000; i++) {
          const v = Math.random() * 40 - 20;
          ctx.fillStyle = `rgba(${45 + v},${45 + v},${45 + v},0.5)`;
          ctx.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 3 + 1, Math.random() * 3 + 1);
        }
      });
      mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, metalness: 0.05 });
      break;
    }
    case 'permeable_paver': {
      texture = createCanvasTexture(512, 512, (ctx) => {
        ctx.fillStyle = '#555555';
        ctx.fillRect(0, 0, 512, 512);
        for (let y = 0; y < 512; y += 32) {
          for (let x = 0; x < 512; x += 32) {
            const variation = Math.random() * 15 - 7;
            ctx.fillStyle = `rgb(${85 + variation},${85 + variation},${85 + variation})`;
            ctx.fillRect(x + 1, y + 1, 30, 30);
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, 32, 32);
          }
        }
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? '#00ff88' : '#0088ff';
          ctx.beginPath();
          ctx.arc(Math.random() * 512, Math.random() * 512, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7, metalness: 0.1 });
      break;
    }
    default: {
      mat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    }
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  return mesh;
}

function createSidewalk(config: EraContent['street'], side: 'left' | 'right'): THREE.Mesh {
  const swGeo = new THREE.PlaneGeometry(60, config.sidewalkWidth);

  let color = 0xaaaaaa;
  if (config.surfaceMaterial === 'permeable_paver') {
    color = 0x888888;
  } else if (config.surfaceMaterial === 'cobblestone') {
    color = 0x998877;
  }

  const swMat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(swGeo, swMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.position.z =
    side === 'left'
      ? config.roadWidth / 2 + config.sidewalkWidth / 2
      : -(config.roadWidth / 2 + config.sidewalkWidth / 2);

  return mesh;
}

function createCrosswalk(config: EraContent['street']): THREE.Mesh | null {
  if (!config.hasCrosswalks) return null;

  const geo = new THREE.PlaneGeometry(60, 0.3);
  const texture = createCanvasTexture(512, 32, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, 512, 32);
    for (let x = 0; x < 512; x += 60) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, 0, 40, 32);
    }
  });

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    roughness: 0.8,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.03, 0);
  return mesh;
}

// ─── Lamp post builder ─────────────────────────────────────────────────────

interface LampPostData {
  count: number;
  spacing: number;
  globeStyle: 'warm' | 'cool' | 'neon' | 'smart';
  poleColor: number;
  globeRadius: number;
}

function createLampPost(lampData: LampPostData, index: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `lamp_post_${index}`;

  const poleHeight = 5;
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, poleHeight);
  const poleMat = new THREE.MeshStandardMaterial({
    color: lampData.poleColor,
    roughness: 0.6,
    metalness: 0.3,
  });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = poleHeight / 2;
  group.add(pole);

  // Arm
  const armGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.4, poleHeight - 0.3, 0);
  group.add(arm);

  // Globe based on style
  let globeMat: THREE.MeshStandardMaterial;
  switch (lampData.globeStyle) {
    case 'warm': {
      globeMat = new THREE.MeshStandardMaterial({
        color: 0xffcc88, emissive: 0xffaa44, emissiveIntensity: 0.8,
        roughness: 0.3, transparent: true, opacity: 0.9,
      });
      break;
    }
    case 'cool': {
      globeMat = new THREE.MeshStandardMaterial({
        color: 0xccddff, emissive: 0x8899cc, emissiveIntensity: 0.6,
        roughness: 0.3, transparent: true, opacity: 0.9,
      });
      break;
    }
    case 'neon': {
      globeMat = new THREE.MeshStandardMaterial({
        color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 1.2,
        roughness: 0.2, transparent: true, opacity: 0.95,
      });
      break;
    }
    case 'smart':
    default: {
      globeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xaaddff, emissiveIntensity: 0.9,
        roughness: 0.2, transparent: true, opacity: 0.95,
      });
      break;
    }
  }

  const globeGeo = new THREE.SphereGeometry(lampData.globeRadius, 16, 16);
  const globe = new THREE.Mesh(globeGeo, globeMat);
  globe.position.set(0.8, poleHeight - 0.5, 0);
  group.add(globe);

  // Point light for warm globes
  if (lampData.globeStyle === 'warm') {
    const light = new THREE.PointLight(0xffaa44, 2, 15);
    light.position.set(0.8, poleHeight - 0.5, 0);
    group.add(light);
  }

  return group;
}

// ─── Furniture builders ────────────────────────────────────────────────────

function createSandbag(position: { x: number; z: number; rotationY: number }): THREE.Group {
  const group = new THREE.Group();
  group.name = 'sandbag';

  const sandbagGeo = new THREE.CapsuleGeometry(0.2, 0.4, 4, 8);
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xc4a35a, roughness: 0.9 });

  // Pile of sandbags
  for (let i = 0; i < 3; i++) {
    const bag = new THREE.Mesh(sandbagGeo, sandMat.clone());
    bag.position.set(i * 0.35 - 0.35, 0.2, 0);
    bag.rotation.z = Math.PI / 2;
    bag.scale.y = 0.6;
    group.add(bag);
  }

  group.position.set(position.x, 0, position.z);
  group.rotation.y = position.rotationY;
  return group;
}

function createBarricade(position: { x: number; z: number; length: number }): THREE.Group {
  const group = new THREE.Group();
  group.name = 'barricade';

  const plankGeo = new THREE.BoxGeometry(position.length, 0.15, 0.1);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 });

  for (let i = 0; i < 2; i++) {
    const plank = new THREE.Mesh(plankGeo, woodMat.clone());
    plank.position.set(0, 0.3 + i * 0.3, 0);
    group.add(plank);
  }

  const postGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
  for (let i = -1; i <= 1; i += 2) {
    const post = new THREE.Mesh(postGeo, woodMat.clone());
    post.position.set(i * position.length / 2, 0.4, 0);
    group.add(post);
  }

  group.position.set(position.x, 0, position.z);
  return group;
}

function createPoster(position: { x: number; z: number; text: string }): THREE.Group {
  const group = new THREE.Group();
  group.name = 'poster';

  const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.5);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.y = 0.75;
  group.add(post);

  // Paper with text
  const texture = createCanvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#f5f0e0';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(position.text, 128, 70);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, 246, 118);
  });

  const paperGeo = new THREE.PlaneGeometry(0.5, 0.25);
  const paperMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 });
  const paper = new THREE.Mesh(paperGeo, paperMat);
  paper.position.set(0, 1.3, 0.01);
  group.add(paper);

  group.position.set(position.x, 0, position.z);
  return group;
}

function createPhoneBooth(position: { x: number; z: number }, colorHex: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'phone_booth';

  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4, metalness: 0.6 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 0.8), bodyMat);
  body.position.y = 1.25;
  group.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.0), bodyMat);
  roof.position.y = 2.55;
  group.add(roof);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x88aacc, transparent: true, opacity: 0.4, roughness: 0.1,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), glassMat);
  glass.position.set(0, 1.5, 0.41);
  group.add(glass);

  const handsetMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const handset = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2), handsetMat);
  handset.rotation.z = Math.PI / 4;
  handset.position.set(0, 1.8, 0.35);
  group.add(handset);

  group.position.set(position.x, 0, position.z);
  return group;
}

function createFireHydrant(position: { x: number; z: number }, colorHex: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'fire_hydrant';

  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.4 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.3, 8), mat);
  base.position.y = 0.15;
  group.add(base);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 8), mat);
  body.position.y = 0.6;
  group.add(body);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  cap.position.y = 0.9;
  group.add(cap);

  const nozzleGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.15);
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI * 2 / 3) {
    const nozzle = new THREE.Mesh(nozzleGeo, mat);
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.set(Math.cos(angle) * 0.15, 0.5, Math.sin(angle) * 0.15);
    group.add(nozzle);
  }

  group.position.set(position.x, 0, position.z);
  return group;
}

function createMailbox(position: { x: number; z: number }, colorHex: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'mailbox';

  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6, metalness: 0.3 });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0), mat);
  post.position.y = 0.5;
  group.add(post);

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.25), mat);
  box.position.y = 1.15;
  group.add(box);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  dome.position.y = 1.32;
  group.add(dome);

  const flagGeo = new THREE.BoxGeometry(0.02, 0.15, 0.02);
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.22, 1.2, 0);
  group.add(flag);

  group.position.set(position.x, 0, position.z);
  return group;
}

function createGraffiti(wallPos: { x: number; z: number; width: number; height: number }, colors: number[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'graffiti';

  const texture = createCanvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, 512, 256);
    // Random tags
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = '#' + colors[i % colors.length].toString(16).padStart(6, '0');
      ctx.lineWidth = Math.random() * 8 + 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Math.random() * 512, Math.random() * 256);
      ctx.bezierCurveTo(
        Math.random() * 512, Math.random() * 256,
        Math.random() * 512, Math.random() * 256,
        Math.random() * 512, Math.random() * 256
      );
      ctx.stroke();
    }
    // Spray dots
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = '#' + colors[Math.floor(Math.random() * colors.length)].toString(16).padStart(6, '0');
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 256, Math.random() * 4 + 1, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const wallGeo = new THREE.PlaneGeometry(wallPos.width, wallPos.height);
  const wallMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 1.5, 0);
  group.add(wall);

  group.position.set(wallPos.x, 0, wallPos.z);
  return group;
}

function createPayphone(position: { x: number; z: number }, colorHex: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'payphone';

  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.5 });

  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.5), mat);
  cabinet.position.y = 0.9;
  group.add(cabinet);

  const slotMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), slotMat);
  slot.position.set(0, 1.2, 0.26);
  group.add(slot);

  const handsetMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const handset = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16, Math.PI), handsetMat);
  handset.position.set(0, 1.5, 0.26);
  group.add(handset);

  const cordGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.3);
  const cord = new THREE.Mesh(cordGeo, handsetMat);
  cord.rotation.z = Math.PI / 4;
  cord.position.set(0, 1.35, 0.28);
  group.add(cord);

  group.position.set(position.x, 0, position.z);
  return group;
}

function createBusShelter(position: { x: number; z: number }, style: 'simple' | 'modern' | 'digital'): THREE.Group {
  const group = new THREE.Group();
  group.name = 'bus_shelter';

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4, metalness: 0.6 });

  // Posts
  const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5);
  [[-1.5, 0], [1.5, 0], [-1.5, 1.5], [1.5, 1.5]].forEach(([px, pz]) => {
    const post = new THREE.Mesh(postGeo, frameMat);
    post.position.set(px, 1.25, pz);
    group.add(post);
  });

  // Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 2.0), frameMat);
  roof.position.y = 2.5;
  group.add(roof);

  // Glass panels
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x88aacc, transparent: true, opacity: 0.3, roughness: 0.1,
  });

  const backGlass = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.0), glassMat);
  backGlass.position.set(0, 1.3, -1.0);
  group.add(backGlass);

  const leftGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.0), glassMat);
  leftGlass.position.set(-1.5, 1.3, 0);
  leftGlass.rotation.y = Math.PI / 2;
  group.add(leftGlass);

  // Bench
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.4), benchMat);
  seat.position.set(0, 0.45, -0.6);
  group.add(seat);

  // Style-specific additions
  if (style === 'modern') {
    const ledGeo = new THREE.BoxGeometry(3.0, 0.03, 0.03);
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5,
    });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 2.45, 0.95);
    group.add(led);
  }

  if (style === 'digital') {
    const screenTex = createCanvasTexture(256, 128, (ctx) => {
      ctx.fillStyle = '#001122';
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('NEXT BUS: 3 min', 20, 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px monospace';
      ctx.fillText('Route 42 → Downtown', 20, 80);
      ctx.fillStyle = '#ffaa00';
      ctx.fillText('Express • Real-time', 20, 105);
    });

    const screenGeo = new THREE.PlaneGeometry(1.5, 0.7);
    const screenMat = new THREE.MeshStandardMaterial({
      map: screenTex, emissive: 0x00ff88, emissiveIntensity: 0.3,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 2.0, 0.8);
    group.add(screen);
  }

  group.position.set(position.x, 0, position.z);
  return group;
}

function createNeonClutter(decoration: { x: number; z: number; type: string; color: number }): THREE.Group {
  const group = new THREE.Group();
  group.name = 'neon_clutter';

  const neonMat = new THREE.MeshStandardMaterial({
    color: decoration.color,
    emissive: decoration.color,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.9,
  });

  if (decoration.type === 'neon_tube') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0), neonMat);
    tube.position.y = 2.0;
    group.add(tube);
  } else if (decoration.type === 'neon_sign') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.05), neonMat);
    sign.position.y = 2.2;
    group.add(sign);
  }

  group.position.set(decoration.x, 0, decoration.z);
  return group;
}

function createTrafficSignal(position: { x: number; z: number }): THREE.Group {
  const group = new THREE.Group();
  group.name = 'traffic_signal';

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4), poleMat);
  pole.position.y = 2;
  group.add(pole);

  const housingMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.3), housingMat);
  housing.position.set(0.2, 3.5, 0);
  group.add(housing);

  const lightColors = [0xff0000, 0xffff00, 0x00ff00] as const;
  lightColors.forEach((color, i) => {
    const lightGeo = new THREE.CircleGeometry(0.1, 16);
    const lightMat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.5 + i * 0.2,
    });
    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
    lightMesh.position.set(0.41, 3.7 - i * 0.3, 0);
    lightMesh.rotation.y = Math.PI / 2;
    group.add(lightMesh);
  });

  group.position.set(position.x, 0, position.z);
  return group;
}

function createBikeLaneMarking(bikeConfig: NonNullable<EraContent['street']['bikeLaneMarkings']>[number], roadWidth: number): THREE.Group {
  const stripeCount = Math.floor(60 / bikeConfig.stripeSpacing);
  const stripeGeo = new THREE.PlaneGeometry(0.15, 0.8);
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0x00aa00, emissive: 0x00aa00, emissiveIntensity: 0.3,
  });

  const group = new THREE.Group();
  group.name = 'bike_lane_marking';

  const laneZ = bikeConfig.side === 'left'
    ? roadWidth / 2 - bikeConfig.laneWidth / 2
    : -(roadWidth / 2 - bikeConfig.laneWidth / 2);

  for (let i = 0; i < stripeCount; i++) {
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-30 + i * bikeConfig.stripeSpacing, 0.04, laneZ);
    group.add(stripe);
  }

  return group;
}

function createEVChargingPost(position: { x: number; z: number }): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ev_charging_post';

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.3, metalness: 0.5 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.2), bodyMat);
  body.position.y = 0.6;
  group.add(body);

  // Screen
  const screenTex = createCanvasTexture(128, 64, (ctx) => {
    ctx.fillStyle = '#003366';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('CHARGING', 20, 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.fillText('85%', 50, 50);
  });

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.15),
    new THREE.MeshStandardMaterial({ map: screenTex, emissive: 0x00ff88, emissiveIntensity: 0.5 }));
  screen.position.set(0, 0.9, 0.11);
  group.add(screen);

  // Cable reel
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x444444 }));
  reel.rotation.x = Math.PI / 2;
  reel.position.set(0, 0.4, 0.13);
  group.add(reel);

  // Status LED
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02),
    new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 2 }));
  led.position.set(0.15, 1.1, 0.11);
  group.add(led);

  group.position.set(position.x, 0, position.z);
  return group;
}

function createSensorCamera(position: { x: number; z: number; poleHeight: number }): THREE.Group {
  const group = new THREE.Group();
  group.name = 'sensor_camera';

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.6 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, position.poleHeight), poleMat);
  pole.position.y = position.poleHeight / 2;
  group.add(pole);

  const housingMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.3), housingMat);
  housing.position.set(0, position.poleHeight - 0.15, 0.1);
  group.add(housing);

  const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05), lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, position.poleHeight - 0.15, 0.28);
  group.add(lens);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), poleMat);
  antenna.position.set(0, position.poleHeight + 0.15, 0);
  group.add(antenna);

  const led = new THREE.Mesh(new THREE.SphereGeometry(0.015),
    new THREE.MeshStandardMaterial({ color: 0x00aaff, emissive: 0x00aaff, emissiveIntensity: 1.5 }));
  led.position.set(0.1, position.poleHeight - 0.2, 0);
  group.add(led);

  group.position.set(position.x, 0, position.z);
  return group;
}

function createPlanter(position: { x: number; z: number }, plantType: 'bush' | 'tree' | 'flower'): THREE.Group {
  const group = new THREE.Group();
  group.name = 'planter';

  // Pot
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 }));
  pot.position.y = 0.2;
  group.add(pot);

  // Soil
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x3d2817 }));
  soil.position.y = 0.4;
  group.add(soil);

  // Plant
  if (plantType === 'bush') {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.9 }));
    bush.position.y = 0.7;
    group.add(bush);
  } else if (plantType === 'tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
    trunk.position.y = 0.8;
    group.add(trunk);

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.9 }));
    canopy.position.y = 1.4;
    group.add(canopy);
  } else {
    const flowerColors = [0xff69b4, 0xff0000, 0xffff00, 0xff6600] as const;
    for (let i = 0; i < 5; i++) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.08),
        new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.8 }));
      const angle = (i / 5) * Math.PI * 2;
      flower.position.set(Math.cos(angle) * 0.2, 0.6 + Math.random() * 0.2, Math.sin(angle) * 0.2);
      group.add(flower);
    }
  }

  group.position.set(position.x, 0, position.z);
  return group;
}

function createDigitalBusDisplay(position: { x: number; z: number }, showRoute: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = 'digital_bus_display';

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.6 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.5), poleMat);
  pole.position.y = 1.25;
  group.add(pole);

  // Display screen
  const screenTex = createCanvasTexture(256, 128, (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('DEPARTURES', 60, 30);
    if (showRoute) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('42 Downtown', 20, 60);
      ctx.fillText('15 Airport Exp', 20, 85);
      ctx.fillStyle = '#ffaa00';
      ctx.fillText('Next: 2 min', 20, 110);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText('Loading...', 80, 70);
    }
  });

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4),
    new THREE.MeshStandardMaterial({ map: screenTex, emissive: 0x00ff00, emissiveIntensity: 0.4 }));
  screen.position.set(0, 2.3, 0.01);
  group.add(screen);

  // Back panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x222222 }));
  panel.position.set(0, 2.3, 0);
  group.add(panel);

  group.position.set(position.x, 0, position.z);
  return group;
}

// ─── Main factory ──────────────────────────────────────────────────────────

export function createStreetEnvironment(config: EraContent['street']): StreetEnvironmentResult {
  const group = new THREE.Group();
  group.name = 'street-environment';

  // Road surface
  const road = createRoadSurface(config);
  group.add(road);

  // Sidewalks
  const leftSw = createSidewalk(config, 'left');
  leftSw.name = 'sidewalk_left';
  group.add(leftSw);

  const rightSw = createSidewalk(config, 'right');
  rightSw.name = 'sidewalk_right';
  group.add(rightSw);

  // Crosswalk
  const crosswalk = createCrosswalk(config);
  if (crosswalk) {
    crosswalk.name = 'crosswalk';
    group.add(crosswalk);
  }

  // Lamp posts
  const lampPostGroups: THREE.Group[] = [];
  const lampPostsArr = config.lampPosts;
  if (lampPostsArr && lampPostsArr.length > 0) {
    const lpConfig = lampPostsArr[0];
    for (let i = 0; i < lpConfig.count; i++) {
      const x = -((lpConfig.count - 1) * lpConfig.spacing) / 2 + i * lpConfig.spacing;
      const lampPost = createLampPost(lpConfig, i);
      lampPost.position.set(x, 0, config.roadWidth / 2 + 0.5);
      group.add(lampPost);
      lampPostGroups.push(lampPost);
    }
  }

  // Register all furniture by name prefix for animation lookup
  // We track them here so we can animate in/out later
  const furnitureByName = new Map<string, Array<{ obj: THREE.Object3D; typeName: string }>>();
  function registerFurniture(obj: THREE.Object3D, typeName: string): void {
    if (!furnitureByName.has(typeName)) {
      furnitureByName.set(typeName, []);
    }
    furnitureByName.get(typeName)!.push({ obj, typeName });
  }

  // Sandbags (1945)
  if (config.sandbags) {
    config.sandbags.forEach((sg) => {
      sg.pilePositions.forEach((pos) => {
        const sb = createSandbag(pos);
        group.add(sb);
        registerFurniture(sb, 'sandbag');
      });
    });
  }

  // Barricades (1945)
  if (config.barricades) {
    config.barricades.forEach((bc) => {
      bc.positions.forEach((pos) => {
        const br = createBarricade(pos);
        group.add(br);
        registerFurniture(br, 'barricade');
      });
    });
  }

  // Posters (1945)
  if (config.posters) {
    config.posters.forEach((pc) => {
      pc.wallPositions.forEach((wp) => {
        const pst = createPoster(wp);
        group.add(pst);
        registerFurniture(pst, 'poster');
      });
    });
  }

  // Phone booths (1965)
  if (config.phoneBooths) {
    config.phoneBooths.forEach((pb) => {
      pb.positions.forEach((pos) => {
        const ph = createPhoneBooth(pos, pb.color);
        group.add(ph);
        registerFurniture(ph, 'phone_booth');
      });
    });
  }

  // Fire hydrants (1965)
  if (config.fireHydrants) {
    config.fireHydrants.forEach((fh) => {
      fh.positions.forEach((pos) => {
        const hy = createFireHydrant(pos, fh.color);
        group.add(hy);
        registerFurniture(hy, 'fire_hydrant');
      });
    });
  }

  // Mailboxes (1965)
  if (config.mailboxes) {
    config.mailboxes.forEach((mb) => {
      mb.positions.forEach((pos) => {
        const mx = createMailbox(pos, mb.color);
        group.add(mx);
        registerFurniture(mx, 'mailbox');
      });
    });
  }

  // Graffiti (1985)
  if (config.graffiti) {
    config.graffiti.forEach((gc) => {
      gc.wallPositions.forEach((wp) => {
        const gr = createGraffiti(wp, gc.colors);
        group.add(gr);
        registerFurniture(gr, 'graffiti');
      });
    });
  }

  // Payphones (1985)
  if (config.payphones) {
    config.payphones.forEach((pp) => {
      pp.positions.forEach((pos) => {
        const pay = createPayphone(pos, pp.color);
        group.add(pay);
        registerFurniture(pay, 'payphone');
      });
    });
  }

  // Bus shelters (1985, 2005, 2025)
  if (config.busShelters) {
    config.busShelters.forEach((bs) => {
      bs.positions.forEach((pos) => {
        const sh = createBusShelter(pos, bs.style);
        group.add(sh);
        registerFurniture(sh, 'bus_shelter');
      });
    });
  }

  // Neon clutter (1985)
  if (config.neonClutter) {
    config.neonClutter.forEach((nc) => {
      nc.poleDecorations.forEach((dec) => {
        const nn = createNeonClutter(dec);
        group.add(nn);
        registerFurniture(nn, 'neon');
      });
    });
  }

  // Traffic signals (2005)
  if (config.trafficSignals) {
    config.trafficSignals.forEach((ts) => {
      ts.cornerPositions.forEach((pos) => {
        const sig = createTrafficSignal(pos);
        group.add(sig);
        registerFurniture(sig, 'traffic_signal');
      });
    });
  }

  // Bike lane markings (2005)
  const bikeLaneConfigs = config.bikeLaneMarkings;
  if (bikeLaneConfigs && bikeLaneConfigs.length > 0) {
    bikeLaneConfigs.forEach((blm) => {
      const bikeLane = createBikeLaneMarking(blm, config.roadWidth);
      group.add(bikeLane);
      registerFurniture(bikeLane, 'bike_lane');
    });
  }

  // EV charging posts (2025)
  if (config.evChargingPosts) {
    config.evChargingPosts.forEach((ev) => {
      ev.positions.forEach((pos) => {
        const evp = createEVChargingPost(pos);
        group.add(evp);
        registerFurniture(evp, 'ev_charging');
      });
    });
  }

  // Sensor cameras (2025)
  if (config.sensorCameras) {
    config.sensorCameras.forEach((sc) => {
      sc.positions.forEach((pos) => {
        const cam = createSensorCamera(pos);
        group.add(cam);
        registerFurniture(cam, 'sensor_camera');
      });
    });
  }

  // Planters (2025)
  if (config.planters) {
    config.planters.forEach((p) => {
      p.positions.forEach((pos) => {
        const pl = createPlanter(pos, p.plantType);
        group.add(pl);
        registerFurniture(pl, 'planter');
      });
    });
  }

  // Digital bus displays (2025)
  if (config.digitalBusDisplays) {
    config.digitalBusDisplays.forEach((dbd) => {
      dbd.positions.forEach((pos) => {
        const disp = createDigitalBusDisplay(pos, dbd.showRoute);
        group.add(disp);
        registerFurniture(disp, 'digital_bus_display');
      });
    });
  }

  // ─── Type set extraction ──────────────────────────────────────────────

  /** Build the set of furniture type names present in this config. */
  function buildTypeSet(cfg: EraContent['street']): Set<string> {
    const s = new Set<string>();
    if (cfg.lampPosts && cfg.lampPosts.length > 0) s.add('lamp_post');
    if (cfg.sandbags) cfg.sandbags.forEach(() => s.add('sandbag'));
    if (cfg.barricades) cfg.barricades.forEach(() => s.add('barricade'));
    if (cfg.posters) cfg.posters.forEach(() => s.add('poster'));
    if (cfg.phoneBooths) cfg.phoneBooths.forEach(() => s.add('phone_booth'));
    if (cfg.fireHydrants) cfg.fireHydrants.forEach(() => s.add('fire_hydrant'));
    if (cfg.mailboxes) cfg.mailboxes.forEach(() => s.add('mailbox'));
    if (cfg.graffiti) cfg.graffiti.forEach(() => s.add('graffiti'));
    if (cfg.payphones) cfg.payphones.forEach(() => s.add('payphone'));
    if (cfg.busShelters) cfg.busShelters.forEach(() => s.add('bus_shelter'));
    if (cfg.neonClutter) cfg.neonClutter.forEach(() => s.add('neon'));
    if (cfg.trafficSignals) cfg.trafficSignals.forEach(() => s.add('traffic_signal'));
    if (cfg.bikeLaneMarkings && cfg.bikeLaneMarkings.length > 0) s.add('bike_lane');
    if (cfg.evChargingPosts) cfg.evChargingPosts.forEach(() => s.add('ev_charging'));
    if (cfg.sensorCameras) cfg.sensorCameras.forEach(() => s.add('sensor_camera'));
    if (cfg.planters) cfg.planters.forEach(() => s.add('planter'));
    if (cfg.digitalBusDisplays) cfg.digitalBusDisplays.forEach(() => s.add('digital_bus_display'));
    return s;
  }

  // Track current visible types for transition comparison
  const visibleTypes = buildTypeSet(config);
  let currentEraRef = '' as EraId;

  // ─── Globe style update helper ─────────────────────────────────────────

  function updateGlobeMaterial(mesh: THREE.Mesh, style: string): void {
    if (!(mesh.material instanceof THREE.MeshStandardMaterial)) return;
    const mat = mesh.material;
    switch (style) {
      case 'warm':
        mat.color.setHex(0xffcc88);
        mat.emissive.setHex(0xffaa44);
        mat.emissiveIntensity = 0.8;
        break;
      case 'cool':
        mat.color.setHex(0xccddff);
        mat.emissive.setHex(0x8899cc);
        mat.emissiveIntensity = 0.6;
        break;
      case 'neon':
        mat.color.setHex(0xff00ff);
        mat.emissive.setHex(0xff00ff);
        mat.emissiveIntensity = 1.2;
        break;
      case 'smart':
      default:
        mat.color.setHex(0xffffff);
        mat.emissive.setHex(0xaaddff);
        mat.emissiveIntensity = 0.9;
        break;
    }
  }

  function getOpacity(obj: THREE.Object3D): number {
    if (obj instanceof THREE.Mesh) {
      if (Array.isArray(obj.material)) {
        return (obj.material[0] as THREE.Material).opacity ?? 1;
      }
      return (obj.material as THREE.Material).opacity ?? 1;
    }
    return 1;
  }

  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ─── applyEra method with animated transitions ─────────────────────────

  function applyEra(eraId: EraId): void {
    if (currentEraRef === eraId) return;
    currentEraRef = eraId;

    // Get target config for this era
    import('../../content/eraConfig.js').then((module) => {
      const erasMap = module.default as Record<string, { street: EraContent['street'] }>;
      const targetCfg = erasMap[eraId]?.street;
      if (!targetCfg) return;

      const transitionDuration = 800; // ms
      const startTime = performance.now();
      const targetTypes = buildTypeSet(targetCfg);

      // Determine which props need to fade in vs out
      const allTypeNames = new Set<string>([...visibleTypes, ...targetTypes]);
      const animations: Array<{
        obj: THREE.Object3D;
        startScale: number;
        endScale: number;
        startOpacity: number;
        endOpacity: number;
        globeStyle?: string;
      }> = [];

      allTypeNames.forEach((typeName) => {
        const hadIt = visibleTypes.has(typeName);
        const hasItNow = targetTypes.has(typeName);

        if (hadIt && !hasItNow) {
          // Fade out
          const items = furnitureByName.get(typeName);
          if (items) {
            items.forEach(({ obj }) => {
              animations.push({
                obj,
                startScale: 1, endScale: 0.5,
                startOpacity: getOpacity(obj),
                endOpacity: 0,
              });
            });
          }
        } else if (!hadIt && hasItNow) {
          // Fade in
          const items = furnitureByName.get(typeName);
          if (items) {
            items.forEach(({ obj }) => {
              animations.push({
                obj,
                startScale: 0.5, endScale: 1,
                startOpacity: 0,
                endOpacity: getOpacity(obj),
              });
            });
          }
        }
      });

      // Update lamp post globe styles
      const newLampPosts = targetCfg.lampPosts;
      if (newLampPosts && newLampPosts.length > 0) {
        const newStyle = newLampPosts[0].globeStyle;
        lampPostGroups.forEach((lpGroup) => {
          lpGroup.traverse((child) => {
            if (child instanceof THREE.Mesh && child.geometry.type === 'SphereGeometry') {
              animations.push({
                obj: child,
                startScale: 1, endScale: 1,
                startOpacity: getOpacity(child),
                endOpacity: getOpacity(child),
                globeStyle: newStyle,
              });
            }
          });
        });
      }

      // Run animation loop
      function tick(): void {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / transitionDuration, 1);
        const eased = easeInOutCubic(progress);

        animations.forEach((anim) => {
          anim.obj.scale.setScalar(
            anim.startScale + (anim.endScale - anim.startScale) * eased
          );

          // Handle globe color transition
          if (anim.globeStyle) {
            updateGlobeMaterial(anim.obj as THREE.Mesh, anim.globeStyle);
          } else {
            // Handle opacity/fade transition
            anim.obj.traverse((c) => {
              if (c instanceof THREE.Mesh) {
                const mats = Array.isArray(c.material) ? c.material : [c.material];
                mats.forEach((m: THREE.Material) => {
                  m.opacity = anim.startOpacity + (anim.endOpacity - anim.startOpacity) * eased;
                  m.transparent = m.opacity < 1;
                });
              }
            });
          }
        });

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          // Update visible types
          visibleTypes.clear();
          targetTypes.forEach((t) => visibleTypes.add(t));
        }
      }

      requestAnimationFrame(tick);
    });
  }

  return { group, applyEra };
}
