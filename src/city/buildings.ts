import * as THREE from 'three';
import { eraConfigs, type BuildingsConfig } from '../eras';
import { useEraTimeline } from '../store/eraTimeline';

/**
 * Era-morphing city-block building subsystem.
 *
 * A parameterized block of buildings (low / mid / high-rise templates) reads the
 * shared era timeline store and continuously interpolates:
 *   - building height (grows as the era advances),
 *   - facade material + color palette (crossfaded between the current and target
 *     era via two overlapping boxes whose opacity ramps),
 *   - window emissive color / intensity,
 *   - window grid style (rebuilt when the dominant window style changes).
 *
 * Windows are emitted through two shared `InstancedMesh` objects (one per era
 * being blended) so repeated window geometry stays cheap even across a tall,
 * dense block.
 */

type TemplateId = 'low' | 'mid' | 'high';

/** Per-template dimensions and how much of the era height range it occupies. */
interface Template {
  width: number;
  depth: number;
  heightFactor: number;
}

const TEMPLATES: Record<TemplateId, Template> = {
  low: { width: 6, depth: 6, heightFactor: 0.42 },
  mid: { width: 8, depth: 8, heightFactor: 0.64 },
  high: { width: 11, depth: 11, heightFactor: 0.86 },
};

/** Block layout as a 5×5 grid; the centre cell is left as a plaza. */
const GRID: (TemplateId | 'plaza')[][][] = [
  [['low'], ['mid'], ['high'], ['mid'], ['low']],
  [['mid'], ['low'], ['mid'], ['low'], ['mid']],
  [['high'], ['mid'], ['plaza'], ['mid'], ['high']],
  [['mid'], ['low'], ['mid'], ['low'], ['mid']],
  [['low'], ['mid'], ['high'], ['mid'], ['low']],
];

/** Distance between grid cells (leaves streets between buildings). */
const CELL = 16;

/** Per-window-style grid parameters. */
interface WindowStyle {
  winW: number;
  winH: number;
  gap: number;
  marginH: number;
  marginV: number;
}

const WINDOW_STYLES: Record<string, WindowStyle> = {
  'small-multi': { winW: 1.1, winH: 1.4, gap: 0.8, marginH: 1.1, marginV: 1.3 },
  'large-grid': { winW: 1.9, winH: 2.4, gap: 1.3, marginH: 1.3, marginV: 1.5 },
  'brutalist-grid': { winW: 1.7, winH: 2.0, gap: 1.1, marginH: 1.2, marginV: 1.4 },
  'curtain-wall': { winW: 1.8, winH: 2.6, gap: 0.4, marginH: 0.8, marginV: 1.0 },
  'floor-to-ceiling': { winW: 2.9, winH: 3.1, gap: 0.7, marginH: 1.0, marginV: 1.1 },
};

/** Facade shading derived from the per-era facade material name. */
function facadeParams(material: string): { metalness: number; roughness: number } {
  switch (material) {
    case 'brick':
      return { metalness: 0, roughness: 0.92 };
    case 'pastel-stucco':
      return { metalness: 0, roughness: 0.85 };
    case 'concrete-glass':
      return { metalness: 0.15, roughness: 0.6 };
    case 'glass-steel':
      return { metalness: 0.7, roughness: 0.25 };
    case 'modern-glass':
      return { metalness: 0.6, roughness: 0.2 };
    default:
      return { metalness: 0.3, roughness: 0.5 };
  }
}

/** One parameterized building on the block. */
interface BuildingDisplay {
  template: TemplateId;
  x: number;
  z: number;
  width: number;
  depth: number;
  heightFactor: number;
  heightVar: number;
  colorSlot: number;
  facadeFrom: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  facadeTo: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  roof: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Smoothstep easing so the morph feels natural, not linear. */
function easeInOut(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function paletteColor(palette: string[], slot: number): string {
  return palette[slot % palette.length];
}

function setColor(target: THREE.Color, hex: string): void {
  target.set(hex);
}

export class Buildings {
  readonly group = new THREE.Group();

  private facadeGeometry = new THREE.BoxGeometry(1, 1, 1);
  private windowGeometry = new THREE.PlaneGeometry(1, 1);

  private windowFromMaterial: THREE.MeshStandardMaterial;
  private windowToMaterial: THREE.MeshStandardMaterial;
  private windowFrom: THREE.InstancedMesh;
  private windowTo: THREE.InstancedMesh;

  private buildings: BuildingDisplay[] = [];
  private lastFromStyle = '';
  private lastToStyle = '';

  static MAX_WINDOWS = 30000;

  constructor() {
    this.windowFromMaterial = new THREE.MeshStandardMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      emissive: new THREE.Color('#ffd9a0'),
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.5,
    });
    this.windowToMaterial = this.windowFromMaterial.clone();

    this.windowFrom = new THREE.InstancedMesh(
      this.windowGeometry,
      this.windowFromMaterial,
      Buildings.MAX_WINDOWS,
    );
    this.windowTo = new THREE.InstancedMesh(
      this.windowGeometry,
      this.windowToMaterial,
      Buildings.MAX_WINDOWS,
    );
    this.windowFrom.count = 0;
    this.windowTo.count = 0;
    this.windowFrom.frustumCulled = false;
    this.windowTo.frustumCulled = false;

    this.group.add(this.windowFrom, this.windowTo);

    this.addGround();
    this.build();
    // Initial window population for the opening era.
    const initial = eraConfigs['1945'].buildings;
    this.rebuildWindows(initial, initial, 1);
  }

  /** Update every building from the era store. Call once per frame. */
  update(_dt: number): void {
    const st = useEraTimeline.getState();
    const from = eraConfigs[st.currentEra].buildings;
    const to = eraConfigs[st.targetEra].buildings;
    const t = easeInOut(st.transitionProgress);

    // Rebuild window geometry only when the dominant window style changes.
    if (this.lastFromStyle !== from.windowStyle || this.lastToStyle !== to.windowStyle) {
      this.rebuildWindows(from, to, t);
    }

    for (const b of this.buildings) {
      const h =
        lerp(from.heightRange[0], from.heightRange[1], t) *
        b.heightFactor *
        b.heightVar;

      b.facadeFrom.scale.y = h;
      b.facadeTo.scale.y = h;
      b.facadeFrom.position.y = h / 2;
      b.facadeTo.position.y = h / 2;

      setColor(b.facadeFrom.material.color, paletteColor(from.facadePalette, b.colorSlot));
      setColor(b.facadeTo.material.color, paletteColor(to.facadePalette, b.colorSlot));

      b.facadeFrom.material.opacity = 1 - t;
      b.facadeTo.material.opacity = t;

      applyFacadeParams(b.facadeFrom.material, from.facadeMaterial);
      applyFacadeParams(b.facadeTo.material, to.facadeMaterial);

      // Rooftop accessory tracks building height + era colour.
      b.roof.position.y = h + 1;
      setColor(b.roof.material.color, paletteColor(to.facadePalette, b.colorSlot + 1));
      b.roof.material.opacity = t;
      b.roof.scale.set(b.width * 0.55, 1.6, b.depth * 0.55);
    }

    // Crossfade the shared window emissive between the two era layers.
    setColor(this.windowFromMaterial.emissive, from.windowEmissiveColor);
    setColor(this.windowToMaterial.emissive, to.windowEmissiveColor);
    this.windowFromMaterial.emissiveIntensity = from.windowEmissiveIntensity;
    this.windowToMaterial.emissiveIntensity = to.windowEmissiveIntensity;
    this.windowFromMaterial.opacity = 1 - t;
    this.windowToMaterial.opacity = t;

    // Skip drawing the fully-faded window layer to save draw calls when settled.
    // At t===0 only the "from" layer is visible; at t===1 only the "to" layer is.
    this.windowFrom.visible = t > 0.001;
    this.windowTo.visible = t < 0.999;
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
  }

  private addGround(): void {
    // NB: The ground / street / sidewalk plates are owned by the Environment
    // subsystem (shared block layout). The Buildings module must NOT add its
    // own full-size ground plane, which would overlap the environment's
    // era-colored plaza plate at the same elevation and cause a cross-subsystem
    // z-fighting / color-conflict on the shared anchors. Only the raised centre
    // plaza pedestal (a distinct feature) lives here.

    // Central plaza block.
    const plaza = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.45, 2, CELL * 0.45),
      new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 }),
    );
    plaza.position.y = 1;
    this.group.add(plaza);
  }

  private build(): void {
    let colorSlot = 0;
    for (let r = 0; r < GRID.length; r++) {
      for (let c = 0; c < GRID[r].length; c++) {
        const templateId = GRID[r][c][0];
        if (templateId === 'plaza') continue;

        const tmp = TEMPLATES[templateId];
        const x = (c - 2) * CELL;
        const z = (r - 2) * CELL;
        const width = tmp.width * (0.9 + Math.random() * 0.2);
        const depth = tmp.depth * (0.9 + Math.random() * 0.2);
        const heightVar = 0.85 + Math.random() * 0.3;

        const matFrom = new THREE.MeshStandardMaterial({
          transparent: true,
          depthWrite: false,
        });
        const matTo = new THREE.MeshStandardMaterial({
          transparent: true,
          depthWrite: false,
        });

        const facadeFrom = new THREE.Mesh(this.facadeGeometry, matFrom);
        const facadeTo = new THREE.Mesh(this.facadeGeometry, matTo);
        facadeFrom.scale.set(width, 1, depth);
        facadeTo.scale.set(width, 1, depth);

        // Rooftop accessory box (water tower / AC / solar) for silhouette variety.
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false }),
        );
        roof.scale.set(width * 0.55, 1.6, depth * 0.55);

        const b: BuildingDisplay = {
          template: templateId,
          x,
          z,
          width,
          depth,
          heightFactor: tmp.heightFactor,
          heightVar,
          colorSlot,
          facadeFrom,
          facadeTo,
          roof,
        };
        this.buildings.push(b);

        const g = new THREE.Group();
        g.position.set(x, 0, z);
        g.add(facadeFrom, facadeTo, roof);
        this.group.add(g);
        colorSlot++;
      }
    }
  }

  private rebuildWindows(from: BuildingsConfig, to: BuildingsConfig, t: number): void {
    const fromTransforms: THREE.Matrix4[] = [];
    const toTransforms: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();

    for (const b of this.buildings) {
      const h =
        lerp(from.heightRange[0], from.heightRange[1], t) *
        b.heightFactor *
        b.heightVar;
      collectWindowTransforms(b, h, from.windowStyle, fromTransforms, dummy);
      collectWindowTransforms(b, h, to.windowStyle, toTransforms, dummy);
    }

    writeInstances(this.windowFrom, fromTransforms);
    writeInstances(this.windowTo, toTransforms);

    this.lastFromStyle = from.windowStyle;
    this.lastToStyle = to.windowStyle;
  }
}

function applyFacadeParams(material: THREE.Material, facadeMaterial: string): void {
  const p = facadeParams(facadeMaterial);
  if (material instanceof THREE.MeshStandardMaterial) {
    material.metalness = p.metalness;
    material.roughness = p.roughness;
  }
}

function writeInstances(mesh: THREE.InstancedMesh, transforms: THREE.Matrix4[]): void {
  mesh.count = Math.min(transforms.length, Buildings.MAX_WINDOWS);
  for (let i = 0; i < mesh.count; i++) {
    mesh.setMatrixAt(i, transforms[i]);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** Collect one window transform per grid slot across all four facades. */
function collectWindowTransforms(
  b: BuildingDisplay,
  h: number,
  style: string,
  out: THREE.Matrix4[],
  dummy: THREE.Object3D,
): void {
  const s = WINDOW_STYLES[style] ?? WINDOW_STYLES['small-multi'];

  const faces: { cx: number; cz: number; faceW: number; rotY: number }[] = [
    { cx: b.x, cz: b.z + b.depth / 2, faceW: b.width, rotY: 0 },
    { cx: b.x, cz: b.z - b.depth / 2, faceW: b.width, rotY: Math.PI },
    { cx: b.x + b.width / 2, cz: b.z, faceW: b.depth, rotY: Math.PI / 2 },
    { cx: b.x - b.width / 2, cz: b.z, faceW: b.depth, rotY: -Math.PI / 2 },
  ];

  for (const f of faces) {
    const cols = Math.max(1, Math.floor((f.faceW - 2 * s.marginH) / (s.winW + s.gap)));
    const rows = Math.max(1, Math.floor((h - 2 * s.marginV) / (s.winH + s.gap)));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const xOff = (i - (cols - 1) / 2) * (s.winW + s.gap);
        const yOff = s.marginV + s.winH / 2 + j * (s.winH + s.gap);
        dummy.position.set(f.cx + xOff, yOff, f.cz);
        dummy.rotation.set(0, f.rotY, 0);
        dummy.scale.set(s.winW, s.winH, 1);
        dummy.updateMatrix();
        out.push(dummy.matrix.clone());
      }
    }
  }
}