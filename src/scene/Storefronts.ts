import * as THREE from 'three';
import type { EraConfig } from '../types';
import { toColor, makeGlowTexture } from '../three-helpers';
import { smoothstep, hash } from '../math';

type SignType = 'paint' | 'neon' | 'led' | 'holo';

interface Storefront {
  group: THREE.Group;
  baseMat: THREE.MeshStandardMaterial; // painted awning / facade
  emissiveMat: THREE.MeshStandardMaterial; // neon/led glowing panel
  holoMat: THREE.MeshBasicMaterial; // holographic shimmer
  position: THREE.Vector3;
  facing: number; // yaw rotation
}

interface Billboard {
  group: THREE.Group;
  panelMat: THREE.MeshStandardMaterial;
  glowMat: THREE.MeshBasicMaterial;
  holoMat: THREE.MeshBasicMaterial;
  type: SignType;
  phase: number;
}

const SIGN_WORDS = ['CAFÉ', 'DINER', 'SHOP', 'BAR', 'HOTEL', 'CINEMA', 'AUTO', 'STAR', 'MOON', 'GLOW', 'NEON', 'TECH'];

/**
 * Storefronts line the ground-floor of buildings; billboards sit on roofs.
 * Both crossfade between painted → neon → LED → holographic styling as the
 * era config weights shift, using smoothstep opacity blending.
 */
export class Storefronts {
  group = new THREE.Group();
  private storefronts: Storefront[] = [];
  private billboards: Billboard[] = [];
  private glowTex: THREE.CanvasTexture;
  private ledTex: THREE.CanvasTexture;

  constructor() {
    this.glowTex = makeGlowTexture('rgba(255,255,255,0.95)', 'rgba(255,180,255,0.5)');
    this.ledTex = this.makeLEDTexture();

    // --- Storefronts along the sidewalk edges facing the roads ---
    const roadHalf = 7;
    const swEdge = roadHalf + 1.6;
    const positions: { x: number; z: number; facing: number }[] = [];
    // Along E-W road (north & south sides)
    for (const z of [swEdge, -swEdge]) {
      for (let x = -30; x <= 30; x += 12) {
        positions.push({ x, z, facing: z > 0 ? Math.PI : 0 });
      }
    }
    // Along N-S road (east & west sides)
    for (const x of [swEdge, -swEdge]) {
      for (let z = -30; z <= 30; z += 12) {
        positions.push({ x, z, facing: x > 0 ? -Math.PI / 2 : Math.PI / 2 });
      }
    }

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const seed = i * 7.3 + 1.1;
      this.storefronts.push(this.makeStorefront(p.x, p.z, p.facing, seed));
    }

    // --- Billboards on rooftops ---
    const billPositions: { x: number; z: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const r = 22 + hash(i) * 8;
      billPositions.push({
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        y: 18 + hash(i * 3) * 22,
      });
    }
    for (let i = 0; i < billPositions.length; i++) {
      const p = billPositions[i];
      this.billboards.push(this.makeBillboard(p.x, p.y, p.z, i));
    }
  }

  private makeLEDTexture(): THREE.CanvasTexture {
    const w = 128;
    const h = 64;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, w, h);
    // LED dot grid
    for (let y = 4; y < h; y += 6) {
      for (let x = 4; x < w; x += 6) {
        const on = Math.random() > 0.55;
        ctx.fillStyle = on
          ? `rgb(${100 + Math.random() * 155},${100 + Math.random() * 155},${120 + Math.random() * 135})`
          : '#15151f';
        ctx.fillRect(x, y, 3, 3);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private makeStorefront(x: number, z: number, facing: number, seed: number): Storefront {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = facing;

    // Awning / painted facade
    const baseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hash(seed), 0.3, 0.4),
      roughness: 0.8,
      metalness: 0.0,
    });
    const awning = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 0.3), baseMat);
    awning.position.set(0, 2.4, -0.4);
    awning.castShadow = true;
    g.add(awning);

    // Glowing sign panel (neon / LED)
    const emissiveMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: new THREE.Color().setHSL(hash(seed * 2), 1, 0.55),
      emissiveIntensity: 0,
      roughness: 0.4,
      metalness: 0.2,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.7), emissiveMat);
    panel.position.set(0, 3.0, -0.25);
    g.add(panel);

    // Holographic shimmer plane (2055)
    const holoMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(hash(seed * 3), 1, 0.6),
      transparent: true,
      opacity: 0,
      toneMapped: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.2), holoMat);
    holo.position.set(0, 2.2, -0.2);
    g.add(holo);

    this.group.add(g);
    return {
      group: g,
      baseMat,
      emissiveMat,
      holoMat,
      position: new THREE.Vector3(x, 0, z),
      facing,
    };
  }

  private makeBillboard(x: number, y: number, z: number, i: number): Billboard {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = hash(i) * Math.PI * 2;

    const hue = hash(i * 5.1);
    // Painted panel
    const panelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(hue, 0.5, 0.4),
      roughness: 0.7,
      emissive: new THREE.Color().setHSL(hue, 0.8, 0.3),
      emissiveIntensity: 0,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), panelMat);
    g.add(panel);

    // Glow border (neon)
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(hash(i * 2.2), 1, 0.6),
      transparent: true,
      opacity: 0,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const border = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.4, 4), glowMat);
    (border.geometry as THREE.BufferGeometry).rotateZ(Math.PI / 4);
    border.scale.set(1.1, 0.55, 1);
    g.add(border);

    // Holographic layer
    const holoMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(hash(i * 3.7), 1, 0.65),
      transparent: true,
      opacity: 0,
      toneMapped: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.6), holoMat);
    g.add(holo);

    this.group.add(g);
    return { group: g, panelMat, glowMat, holoMat, type: 'paint', phase: hash(i) * Math.PI * 2 };
  }

  update(cfg: EraConfig, time: number): void {
    // Normalised weights for each sign style
    const wPaint = smoothstep(cfg.storefrontPaint);
    const wNeon = smoothstep(cfg.storefrontNeon);
    const wLED = smoothstep(cfg.storefrontLED);
    const wHolo = smoothstep(cfg.storefrontHologram);

    for (let i = 0; i < this.storefronts.length; i++) {
      const s = this.storefronts[i];
      // Painted awning visible in early eras
      s.baseMat.opacity = 0.35 + wPaint * 0.65;
      s.baseMat.transparent = true;
      s.baseMat.color.setHSL(hash(i * 7.3 + 1.1), 0.25 + wNeon * 0.5, 0.4);

      // Emissive sign (neon strong, LED medium)
      s.emissiveMat.emissiveIntensity =
        wNeon * cfg.neonIntensity * 3 + wLED * 1.5;
      s.emissiveMat.color.setHSL(hash(i * 14.6 + 2.2), 1 - wLED * 0.5, 0.12);

      // Holographic layer fades in for 2055
      s.holoMat.opacity = wHolo * (0.4 + 0.2 * Math.sin(time * 2 + i));
      s.holoMat.color.setHSL((hash(i * 3.1) + time * 0.02) % 1, 1, 0.6);
    }

    // Billboards
    const bPaint = smoothstep(cfg.billboardPaint);
    const bNeon = smoothstep(cfg.billboardNeon);
    const bLED = smoothstep(cfg.billboardLED);
    const bHolo = smoothstep(cfg.billboardHologram);

    for (let i = 0; i < this.billboards.length; i++) {
      const b = this.billboards[i];
      b.panelMat.emissiveIntensity = bNeon * 2 + bLED * 1.2;
      b.panelMat.color.setHSL(hash(i * 5.1), 0.4 + bLED * 0.3, 0.35);
      if (bLED > 0.1) b.panelMat.map = this.ledTex;
      else b.panelMat.map = null;
      b.panelMat.needsUpdate = true;

      b.glowMat.opacity = bNeon * 0.9 * (0.7 + 0.3 * Math.sin(time * 3 + b.phase));

      b.holoMat.opacity = bHolo * (0.4 + 0.25 * Math.sin(time * 1.5 + b.phase));
      b.holoMat.color.setHSL((hash(i * 3.7) + time * 0.03) % 1, 1, 0.65);

      // Spin holographic billboards slowly
      if (bHolo > 0.1) b.group.rotation.y += 0.002 * bHolo;
      void bPaint;
    }
  }

  dispose(): void {
    this.glowTex.dispose();
    this.ledTex.dispose();
    for (const s of this.storefronts) {
      s.baseMat.dispose();
      s.emissiveMat.dispose();
      s.holoMat.dispose();
      s.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    for (const b of this.billboards) {
      b.panelMat.dispose();
      b.glowMat.dispose();
      b.holoMat.dispose();
      b.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
  }
}

void SIGN_WORDS;
