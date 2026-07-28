/**
 * Billboards and storefronts module.
 * Creates era-specific billboards and storefront signs using CanvasTexture
 * for dynamic text rendering.
 */
import * as THREE from 'three';
import type { EraId } from '../eras';
import type { AppState } from '../state';

interface BillboardSpec {
  /** Billboard text */
  text: string;
  /** Billboard color */
  color: THREE.Color;
  /** Billboard emissive color */
  emissive: THREE.Color;
  /** Billboard emissive intensity */
  intensity: number;
  /** Billboard font size */
  fontSize: number;
  /** Billboard background color */
  bgColor: THREE.Color;
  /** Storefront text */
  storefrontText: string;
  /** Storefront color */
  storefrontColor: THREE.Color;
}

const BILLBOARD_SPECS: Record<EraId, BillboardSpec> = {
  '1945': {
    text: 'WAR BONDS',
    color: new THREE.Color(0xffddaa),
    emissive: new THREE.Color(0xffddaa),
    intensity: 0.3,
    fontSize: 48,
    bgColor: new THREE.Color(0x8b0000),
    storefrontText: 'JOE\'S DINER',
    storefrontColor: new THREE.Color(0x8b0000),
  },
  '1965': {
    text: 'COCA-COLA 5¢',
    color: new THREE.Color(0xff69b4),
    emissive: new THREE.Color(0xff69b4),
    intensity: 0.4,
    fontSize: 48,
    bgColor: new THREE.Color(0x0066cc),
    storefrontText: 'MCDONALD\'S',
    storefrontColor: new THREE.Color(0xff69b4),
  },
  '1985': {
    text: 'VIDEO CITY',
    color: new THREE.Color(0xffff00),
    emissive: new THREE.Color(0xffff00),
    intensity: 0.6,
    fontSize: 48,
    bgColor: new THREE.Color(0x0000ff),
    storefrontText: 'BLOCKBUSTER',
    storefrontColor: new THREE.Color(0x0000ff),
  },
  '2005': {
    text: 'APPLE',
    color: new THREE.Color(0xffffff),
    emissive: new THREE.Color(0x00aaff),
    intensity: 0.7,
    fontSize: 48,
    bgColor: new THREE.Color(0x000000),
    storefrontText: 'STARBUCKS',
    storefrontColor: new THREE.Color(0x006633),
  },
  '2025': {
    text: 'NEXUS AI',
    color: new THREE.Color(0x00ffaa),
    emissive: new THREE.Color(0x00ffaa),
    intensity: 0.8,
    fontSize: 48,
    bgColor: new THREE.Color(0x1a1a2e),
    storefrontText: 'NEST CAFÉ',
    storefrontColor: new THREE.Color(0x00aaff),
  },
  '2055': {
    text: 'MARS COLONY',
    color: new THREE.Color(0x00ffff),
    emissive: new THREE.Color(0x00ffff),
    intensity: 1.0,
    fontSize: 48,
    bgColor: new THREE.Color(0x001a33),
    storefrontText: 'ORBITAL DINER',
    storefrontColor: new THREE.Color(0x00ffff),
  },
};

interface BillboardInstance {
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  spec: BillboardSpec;
  isBillboard: boolean;
}

export class BillboardsModule {
  group: THREE.Group;
  private scene: THREE.Scene;
  private billboards: BillboardInstance[] = [];

  // Shared geometry
  private billboardGeometry!: THREE.PlaneGeometry;
  private storefrontGeometry!: THREE.PlaneGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Shared geometry
    this.billboardGeometry = new THREE.PlaneGeometry(8, 4);
    this.storefrontGeometry = new THREE.PlaneGeometry(3, 1.5);

    this.generateBillboards();
    this.setEra('1945');
  }

  private generateBillboards(): void {
    // Billboard positions (on building sides facing roads)
    const billboardPositions = [
      { x: -18, y: 8, z: 0, facing: 'x' },
      { x: 18, y: 8, z: 0, facing: 'x' },
      { x: 0, y: 8, z: -18, facing: 'z' },
      { x: 0, y: 8, z: 18, facing: 'z' },
    ];

    for (const pos of billboardPositions) {
      const billboard = this.createBillboard('1945');
      billboard.mesh.position.set(pos.x, pos.y, pos.z);
      if (pos.facing === 'x') {
        billboard.mesh.rotation.y = pos.x > 0 ? Math.PI : 0;
      } else {
        billboard.mesh.rotation.y = pos.z > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      this.group.add(billboard.mesh);
      this.billboards.push(billboard);
    }

    // Storefront signs
    const storefrontPositions = [
      { x: -12, y: 3, z: -18, facing: 'z' },
      { x: 12, y: 3, z: -18, facing: 'z' },
      { x: -12, y: 3, z: 18, facing: 'z' },
      { x: 12, y: 3, z: 18, facing: 'z' },
      { x: -18, y: 3, z: -12, facing: 'x' },
      { x: -18, y: 3, z: 12, facing: 'x' },
      { x: 18, y: 3, z: -12, facing: 'x' },
      { x: 18, y: 3, z: 12, facing: 'x' },
    ];

    for (const pos of storefrontPositions) {
      const storefront = this.createStorefront('1945');
      storefront.mesh.position.set(pos.x, pos.y, pos.z);
      if (pos.facing === 'x') {
        storefront.mesh.rotation.y = pos.x > 0 ? Math.PI : 0;
      } else {
        storefront.mesh.rotation.y = pos.z > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      this.group.add(storefront.mesh);
      this.billboards.push(storefront);
    }
  }

  private createCanvas(spec: BillboardSpec): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    this.renderCanvas(ctx, canvas, spec);

    return { canvas, ctx };
  }

  private renderCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, spec: BillboardSpec): void {
    // Background
    const bgHex = `#${spec.bgColor.getHexString()}`;
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text
    ctx.fillStyle = `#${spec.color.getHexString()}`;
    ctx.font = `bold ${spec.fontSize}px 'Segoe UI', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = `#${spec.emissive.getHexString()}`;
    ctx.shadowBlur = spec.intensity * 30;
    ctx.fillText(spec.text, canvas.width / 2, canvas.height / 2);

    // Reset shadow
    ctx.shadowBlur = 0;
  }

  private createBillboard(era: EraId): BillboardInstance {
    const spec = BILLBOARD_SPECS[era];
    const { canvas, ctx } = this.createCanvas(spec);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(this.billboardGeometry, material);
    mesh.castShadow = true;

    return { mesh, canvas, ctx, spec, isBillboard: true };
  }

  private createStorefront(era: EraId): BillboardInstance {
    const spec = BILLBOARD_SPECS[era];
    const { canvas, ctx } = this.createCanvas({
      ...spec,
      text: spec.storefrontText,
      fontSize: 36,
      bgColor: spec.storefrontColor,
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(this.storefrontGeometry, material);
    mesh.castShadow = true;

    return { mesh, canvas, ctx, spec, isBillboard: false };
  }

  setEra(era: EraId): void {
    this.applyEra(era);
  }

  updateTransition(targetEra: EraId, _t: number, _fromEra: EraId): void {

    // Update canvas textures for each billboard
    for (const billboard of this.billboards) {
      const toSpec = BILLBOARD_SPECS[targetEra];

      // Render new canvas
      const billboardSpec = billboard.isBillboard ? toSpec : {
        ...toSpec,
        text: toSpec.storefrontText,
        fontSize: 36,
        bgColor: toSpec.storefrontColor,
      };

      this.renderCanvas(billboard.ctx, billboard.canvas, billboardSpec);
      (billboard.mesh.material as THREE.MeshBasicMaterial).map!.needsUpdate = true;
    }
  }

  private applyEra(era: EraId): void {
    const spec = BILLBOARD_SPECS[era];

    for (const billboard of this.billboards) {
      const billboardSpec = billboard.isBillboard ? spec : {
        ...spec,
        text: spec.storefrontText,
        fontSize: 36,
        bgColor: spec.storefrontColor,
      };

      this.renderCanvas(billboard.ctx, billboard.canvas, billboardSpec);
      (billboard.mesh.material as THREE.MeshBasicMaterial).map!.needsUpdate = true;
    }
  }

  update(_dt: number, _state: AppState): void {
    // Billboard text glow pulse for future eras
    if (this.billboards.length > 0 && this.billboards[0].spec.intensity > 0.8) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.002);
      for (const billboard of this.billboards) {
        const mat = billboard.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.7 + billboard.spec.intensity * 0.3 * (1 + pulse * 0.3);
      }
    }
  }

  dispose(): void {
    this.billboardGeometry.dispose();
    this.storefrontGeometry.dispose();
    for (const billboard of this.billboards) {
      const mat = billboard.mesh.material as THREE.MeshBasicMaterial;
      if (mat.map) {
        mat.map.dispose();
      }
      mat.dispose();
    }
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    this.scene.remove(this.group);
  }
}
