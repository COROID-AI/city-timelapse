/**
 * Billboards module: era-specific advertising signs. Text and colors come
 * from the era palette; the texture is redrawn when the era crosses a
 * boundary so the ad copy changes (WAR BONDS → COCA-COLA → NEON NIGHTS →
 * APPLE → NEXUS AI).
 */
import { BoxGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial } from 'three';
import { EraId, ERA_IDS } from '../eras';
import { colorBlend, colorFromHex, lerp, matColor } from '../helpers';
import { getPalette } from '../palette';
import { AppState, eraBlend, eraIndexAbove, eraIndexBelow } from '../state';

interface Billboard {
  mesh: Mesh;
  material: MeshStandardMaterial;
  texture: CanvasTexture;
  canvas: HTMLCanvasElement;
  text: string;
  x: number;
  z: number;
}

export class Billboards {
  readonly group = new Group();
  private readonly billboards: Billboard[] = [];
  private readonly boardGeom: BoxGeometry;

  constructor() {
    this.boardGeom = new BoxGeometry(6, 3, 0.3);
    const positions: Array<[number, number]> = [
      [-16, -4],
      [16, -4],
      [-16, -12],
      [16, -12],
    ];
    for (const [x, z] of positions) {
      this.billboards.push(this.createBillboard(x, z));
    }
  }

  update(state: AppState): void {
    const below = eraIndexBelow(state.eraFloat);
    const above = eraIndexAbove(state.eraFloat);
    const a = getPalette(ERA_IDS[below]);
    const b = getPalette(ERA_IDS[above]);
    const t = eraBlend(state.eraFloat);

    for (const bb of this.billboards) {
      // Text swaps at era boundaries.
      const label = t > 0.5 ? b.billboard : a.billboard;
      if (label !== bb.text) {
        bb.text = label;
        redrawBillboard(bb, label, t > 0.5 ? b.signage : a.signage);
      }
      // Emissive glow intensity.
      bb.material.emissiveIntensity = lerp(0.5, 1.0, a.windowIntensity);
      bb.material.emissive.copy(colorBlend(a.signage, b.signage, t));
      bb.material.color.copy(colorBlend(a.building, b.building, t));
    }
  }

  private createBillboard(x: number, z: number): Billboard {
    const material = new MeshStandardMaterial({
      color: colorFromHex('#3a3a3a'),
      emissive: colorFromHex('#c8a020'),
      emissiveIntensity: 0.7,
    });
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const mesh = new Mesh(this.boardGeom, material);
    mesh.position.set(x, 4.5, z);
    mesh.rotation.y = z < 0 ? Math.PI : 0;
    const texture = drawBillboard(canvas, 'WAR BONDS', '#c8a020');
    material.map = texture;
    this.group.add(mesh);
    return { mesh, material, texture, canvas, text: 'WAR BONDS', x, z };
  }

  dispose(): void {
    for (const bb of this.billboards) {
      bb.material.dispose();
      bb.texture.dispose();
    }
    this.boardGeom.dispose();
  }
}

function drawBillboard(canvas: HTMLCanvasElement, text: string, fgHex: string): CanvasTexture {
  const g = canvas.getContext('2d');
  if (!g) {
    throw new Error('2D canvas context unavailable');
  }
  g.fillStyle = '#1a1a2a';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = fgHex;
  g.font = 'bold 48px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, canvas.width / 2, canvas.height / 2);
  return new CanvasTexture(canvas);
}

function redrawBillboard(bb: Billboard, text: string, fgHex: string): void {
  const g = bb.canvas.getContext('2d');
  if (!g) {
    return;
  }
  g.fillStyle = '#1a1a2a';
  g.fillRect(0, 0, bb.canvas.width, bb.canvas.height);
  g.fillStyle = fgHex;
  g.font = 'bold 48px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, bb.canvas.width / 2, bb.canvas.height / 2);
  bb.texture.needsUpdate = true;
  bb.material.needsUpdate = true;
}