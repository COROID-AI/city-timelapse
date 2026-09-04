/**
 * Environment module: sky dome, sun/moon disc, fog haze and floating
 * particle atmosphere. Every visual is procedural and tweened per era.
 */
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import { EraId, ERA_IDS } from '../eras';
import { colorBlend, colorFromHex, lerp, Rng } from '../helpers';
import { getPalette } from '../palette';
import { AppState, eraBlend, eraIndexAbove, eraIndexBelow, hexToRgb } from '../state';

const SKY_RADIUS = 90;

interface Particle {
  object: Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  speed: number;
  phase: number;
  amp: number;
}

export class Environment {
  readonly group = new Group();
  private readonly skyDome: Mesh;
  private readonly skyMaterial: MeshStandardMaterial;
  private readonly sunDisc: Mesh;
  private readonly sunMaterial: MeshStandardMaterial;
  private readonly fogPlane: Mesh;
  private readonly fogMaterial: MeshStandardMaterial;
  private readonly particles: Particle[] = [];
  private readonly particleGeom: SphereGeometry;
  private readonly particleMaterial: MeshStandardMaterial;
  private skyTexture: CanvasTexture | null = null;
  private skyKey = '';

  constructor() {
    const domeGeom = new SphereGeometry(SKY_RADIUS, 24, 16);
    this.skyMaterial = new MeshStandardMaterial({ color: colorFromHex('#1a2a3a') });
    this.skyMaterial.side = DoubleSide;
    this.skyDome = new Mesh(domeGeom, this.skyMaterial);

    this.sunMaterial = new MeshStandardMaterial({
      color: colorFromHex('#e8c878'),
      emissive: colorFromHex('#e8c878'),
    });
    this.sunDisc = new Mesh(new SphereGeometry(3.5, 16, 8), this.sunMaterial);
    this.sunDisc.position.set(0, 26, -46);

    this.fogMaterial = new MeshStandardMaterial({ color: colorFromHex('#c8b090') });
    this.fogMaterial.transparent = true;
    this.fogMaterial.opacity = 0.55;
    this.fogPlane = new Mesh(new PlaneGeometry(190, 190), this.fogMaterial);
    this.fogPlane.rotation.set(Math.PI / 2, 0, 0);
    this.fogPlane.position.set(0, 1.2, 0);

    // Particle atmosphere: small emissive spheres drifting slowly.
    this.particleGeom = new SphereGeometry(0.06, 6, 4);
    this.particleMaterial = new MeshStandardMaterial({
      color: colorFromHex('#c8b090'),
      emissive: colorFromHex('#c8b090'),
    });
    const rng = new Rng(0x5eed);
    for (let i = 0; i < 160; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const radius = rng.range(6, 40);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = rng.range(1, 24);
      const object = new Mesh(this.particleGeom, this.particleMaterial);
      object.position.set(x, y, z);
      this.particles.push({
        object,
        baseX: x,
        baseY: y,
        baseZ: z,
        speed: rng.range(0.05, 0.2),
        phase: rng.range(0, Math.PI * 2),
        amp: rng.range(0.5, 2.2),
      });
    }
    for (const p of this.particles) {
      this.group.add(p.object);
    }
    this.group.add(this.skyDome);
    this.group.add(this.sunDisc);
    this.group.add(this.fogPlane);
  }

  update(dt: number, state: AppState): void {
    const belowIdx = eraIndexBelow(state.eraFloat);
    const aboveIdx = eraIndexAbove(state.eraFloat);
    const a = getPalette(ERA_IDS[belowIdx]);
    const b = getPalette(ERA_IDS[aboveIdx]);
    const t = eraBlend(state.eraFloat);

    // Sky gradient via a cached canvas texture (rebuilt only when the era
    // pair or a coarse blend step changes — not every frame).
    const skyKey = `${belowIdx}-${aboveIdx}-${Math.round(t * 16)}`;
    if (skyKey !== this.skyKey) {
      this.skyKey = skyKey;
      const top = colorBlend(a.skyTop, b.skyTop, t);
      const horizon = colorBlend(a.skyHorizon, b.skyHorizon, t);
      this.skyTexture?.dispose();
      this.skyTexture = this.makeSkyGradient(top, horizon);
      this.skyMaterial.map = this.skyTexture;
    }

    // Sun disc color + emissive intensity.
    this.sunMaterial.color.copy(colorBlend(a.sun, b.sun, t));
    this.sunMaterial.emissive.copy(colorBlend(a.sun, b.sun, t));

    // Fog color + opacity (thicker in smog eras).
    this.fogMaterial.color.copy(colorBlend(a.fog, b.fog, t));
    this.fogMaterial.opacity = lerp(0.5, 0.85, lerp(a.particleDensity, b.particleDensity, t));

    // Particles drift slowly; density scales with era.
    const density = lerp(a.particleDensity, b.particleDensity, t);
    for (const p of this.particles) {
      p.object.position.x = p.baseX + Math.sin(state.eraFloat * 0.8 + p.phase) * p.amp;
      p.object.position.y = p.baseY + Math.sin(state.eraFloat * 1.3 + p.phase * 2) * 0.5;
      p.object.position.z = p.baseZ + Math.cos(state.eraFloat * 0.8 + p.phase) * p.amp;
      p.object.visible = density > 0.15;
    }
    void dt;
  }

  dispose(): void {
    this.skyDome.geometry?.dispose();
    this.skyMaterial.dispose();
    this.sunDisc.geometry?.dispose();
    this.sunMaterial.dispose();
    this.fogPlane.geometry?.dispose();
    this.fogMaterial.dispose();
    this.particleGeom.dispose();
    this.particleMaterial.dispose();
    this.skyTexture?.dispose();
    this.skyTexture = null;
  }

  private makeSkyGradient(top: Color, horizon: Color): CanvasTexture {
    const w = 4;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    if (!g) {
      throw new Error('2D canvas context unavailable');
    }
    const grad = g.createLinearGradient(0, 0, 0, h);
    const [tr, tg, tb] = hexToRgb(`#${top.getHexString()}`);
    const [hr, hg, hb] = hexToRgb(`#${horizon.getHexString()}`);
    grad.addColorStop(0, `rgb(${tr},${tg},${tb})`);
    grad.addColorStop(1, `rgb(${hr},${hg},${hb})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    return new CanvasTexture(canvas);
  }
}