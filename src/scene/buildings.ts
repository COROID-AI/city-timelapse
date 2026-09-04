/**
 * Buildings module: the era-driven skyline. Each building has a facade
 * color, window emissive grid, storefront sign, and era-specific rooftop
 * props (water towers → AC units → solar panels). Heights and colors tween
 * continuously with the timeline.
 */
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import { EraId, ERA_IDS } from '../eras';
import { colorBlend, colorFromHex, lerp, makeBox, makeBoxInstanced, matColor, Rng } from '../helpers';
import { getPalette } from '../palette';
import { AppState, eraBlend, eraIndexAbove, eraIndexBelow } from '../state';

interface Building {
  object: Group;
  body: Mesh;
  bodyMaterial: MeshStandardMaterial;
  accentMaterial: MeshStandardMaterial;
  windowMaterial: MeshStandardMaterial;
  windows: InstancedMesh;
  sign: Mesh;
  signMaterial: MeshStandardMaterial;
  signTexture: CanvasTexture;
  signText: string;
  baseX: number;
  baseZ: number;
  width: number;
  depth: number;
  baseHeight: number;
  roof: Mesh;
  roofMaterial: MeshStandardMaterial;
}

export class Buildings {
  readonly group = new Group();
  private readonly buildings: Building[] = [];
  private readonly windowGeom: BoxGeometry;
  private readonly bodyGeom: BoxGeometry;
  private readonly accentGeom: BoxGeometry;
  private readonly roofGeom: BoxGeometry;
  private readonly signGeom: BoxGeometry;

  constructor() {
    this.windowGeom = new BoxGeometry(1, 1, 0.08);
    this.bodyGeom = new BoxGeometry(1, 1, 1);
    this.accentGeom = new BoxGeometry(1, 0.2, 1);
    this.roofGeom = new BoxGeometry(1, 1, 1);
    this.signGeom = new BoxGeometry(3, 1.2, 0.12);

    const rng = new Rng(0xbeef);
    const layout = [
      { x: -14, z: -8, w: 6, d: 6, h: 9 },
      { x: -6, z: -9, w: 6, d: 6, h: 12 },
      { x: 2, z: -8, w: 6, d: 6, h: 8 },
      { x: 10, z: -9, w: 6, d: 6, h: 14 },
      { x: -18, z: -7, w: 5, d: 5, h: 7 },
      { x: 16, z: -7, w: 5, d: 5, h: 10 },
      { x: -10, z: -14, w: 5, d: 5, h: 6 },
      { x: 4, z: -14, w: 5, d: 5, h: 11 },
      { x: 12, z: -13, w: 5, d: 5, h: 9 },
    ];
    for (const spec of layout) {
      this.buildings.push(this.createBuilding(spec.x, spec.z, spec.w, spec.d, spec.h, rng));
    }
  }

  update(state: AppState): void {
    const below = eraIndexBelow(state.eraFloat);
    const above = eraIndexAbove(state.eraFloat);
    const a = getPalette(ERA_IDS[below]);
    const b = getPalette(ERA_IDS[above]);
    const t = eraBlend(state.eraFloat);

    for (const bld of this.buildings) {
      // Height tween.
      const heightScale = lerp(a.buildingScale, b.buildingScale, t);
      const targetHeight = bld.baseHeight * heightScale;
      const current = bld.object.scale.y;
      bld.object.scale.y = lerp(current, targetHeight, 0.08);

      // Facade color.
      bld.bodyMaterial.color.copy(colorBlend(a.building, b.building, t));
      bld.accentMaterial.color.copy(colorBlend(a.buildingAccent, b.buildingAccent, t));

      // Window emissive intensity + color.
      bld.windowMaterial.emissiveIntensity = lerp(a.windowIntensity, b.windowIntensity, t);
      bld.windowMaterial.emissive.copy(colorBlend(a.window, b.window, t));

      // Sign text swaps at era boundaries.
      const label = t > 0.5 ? b.billboard : a.billboard;
      if (label !== bld.signText) {
        bld.signText = label;
        redrawSign(bld.signTexture, label, bld.signMaterial, getPalette(ERA_IDS[t > 0.5 ? above : below]).signage);
      }

      // Rooftop props follow era palette.
      bld.roofMaterial.color.copy(colorBlend(a.roofProp, b.roofProp, t));
    }
  }

  private createBuilding(x: number, z: number, w: number, d: number, h: number, rng: Rng): Building {
    const bodyMaterial = matColor('#8a5a4a');
    const accentMaterial = matColor('#6e4a3a');
    const windowMaterial = new MeshStandardMaterial({
      color: colorFromHex('#d8a26a'),
      emissive: colorFromHex('#d8a26a'),
      emissiveIntensity: 0.35,
    });
    const body = new Mesh(this.bodyGeom, bodyMaterial);
    body.scale.set(w, h, d);
    const accent = new Mesh(this.accentGeom, accentMaterial);
    accent.scale.set(w * 1.04, 0.6, d * 1.04);
    accent.position.y = h * 0.5;
    const object = new Group();
    object.add(body);
    object.add(accent);
    object.position.set(x, h * 0.5, z);

    // Windows: instanced grid on the +Z face.
    const cols = Math.max(2, Math.floor(w * 1.6));
    const rows = Math.max(3, Math.floor(h * 1.1));
    const windows = makeBoxInstanced(this.windowGeom, windowMaterial, cols * rows);
    const winSpacingX = w / (cols + 1);
    const winSpacingY = h / (rows + 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const wx = -w / 2 + (c + 1) * winSpacingX;
        const wy = -h / 2 + (r + 1) * winSpacingY;
        const matrix = new Matrix4();
        matrix.setPosition(wx, wy, d / 2 + 0.05);
        windows.setMatrixAt(idx, matrix);
      }
    }
    windows.instanceMatrix.needsUpdate = true;

    // Storefront sign.
    const signMaterial = new MeshStandardMaterial({
      color: colorFromHex('#e8e8e8'),
      emissive: colorFromHex('#c8a020'),
      emissiveIntensity: 0.8,
    });
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 128;
    const signTexture = makeSignTextureOn(signCanvas, '5¢ Diner', '#c8a020', '#3a3a3a');
    const sign = new Mesh(this.signGeom, signMaterial);
    sign.position.set(0, 0.8, d / 2 + 0.1);
    signMaterial.map = signTexture;

    const roof = new Mesh(this.roofGeom, matColor('#5a4a3a'));
    roof.scale.set(w * 0.5, 1.4, d * 0.5);
    roof.position.y = h + 0.7;

    object.add(sign);
    object.add(roof);
    this.group.add(object);

    return {
      object,
      body,
      bodyMaterial,
      accentMaterial,
      windowMaterial,
      windows,
      sign,
      signMaterial,
      signTexture,
      signText: '5¢ Diner',
      baseX: x,
      baseZ: z,
      width: w,
      depth: d,
      baseHeight: h,
      roof,
      roofMaterial: roof.material as MeshStandardMaterial,
    };
  }

  dispose(): void {
    for (const bld of this.buildings) {
      bld.bodyMaterial.dispose();
      bld.accentMaterial.dispose();
      bld.windowMaterial.dispose();
      bld.windows.dispose();
      bld.signMaterial.dispose();
      bld.signTexture.dispose();
      bld.roofMaterial.dispose();
    }
    this.windowGeom.dispose();
    this.bodyGeom.dispose();
    this.accentGeom.dispose();
    this.roofGeom.dispose();
    this.signGeom.dispose();
  }
}

import { Matrix4 } from 'three';

function redrawSign(texture: CanvasTexture, text: string, material: MeshStandardMaterial, fgHex: string): void {
  const canvas = SIGN_CANVASES.get(texture);
  if (!canvas) {
    return;
  }
  const g = canvas.getContext('2d');
  if (!g) {
    return;
  }
  g.fillStyle = '#3a3a3a';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = fgHex;
  g.font = 'bold 52px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, canvas.width / 2, canvas.height / 2);
  texture.needsUpdate = true;
  material.needsUpdate = true;
}

/** Tracks the source canvas for each sign texture so redraw can mutate it. */
const SIGN_CANVASES = new WeakMap<CanvasTexture, HTMLCanvasElement>();

function makeSignTextureOn(
  canvas: HTMLCanvasElement,
  text: string,
  fgHex: string,
  bgHex: string,
): CanvasTexture {
  const g = canvas.getContext('2d');
  if (!g) {
    throw new Error('2D canvas context unavailable');
  }
  g.fillStyle = bgHex;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = fgHex;
  g.font = 'bold 52px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new CanvasTexture(canvas);
  SIGN_CANVASES.set(tex, canvas);
  return tex;
}