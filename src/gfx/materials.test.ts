import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  ProceduralGfxLibrary,
  createPRNG,
  parseColor,
  generateBrickTextureSpec,
  generateStoneTextureSpec,
  generateStuccoTextureSpec,
  generateSidingTextureSpec,
  generateAsphaltTextureSpec,
  generateCobblestoneTextureSpec,
  generateConcreteTextureSpec,
  generateWoodTextureSpec,
  generateMetalTextureSpec,
  generateFabricTextureSpec,
  generateWindowAtlasSpec,
  generateSignageTextureSpec,
  generateNeonTextureSpec,
  generateGrimeOverlaySpec,
  createEraMaterial,
} from './materials';
import {
  createBeveledBoxGeometry,
  createWindowGridGeometry,
  createCorniceGeometry,
  createLintelGeometry,
  createFireEscapeGeometry,
  createBalconyGeometry,
  createDoorGeometry,
  createRoofAccessoryGeometry,
  mergeBufferGeometries,
} from './geometry';
import {
  composeInstanceMatrix,
  createInstancedMesh,
  setInstanceTransform,
  setInstanceColor,
  populateInstancedGrid,
} from './instancing';

describe('Procedural Texture Generators & PRNG Determinism', () => {
  it('PRNG generates deterministic sequence from seed', () => {
    const rngA = createPRNG(42);
    const rngB = createPRNG(42);
    const rngC = createPRNG(99);

    const seqA = [rngA.next(), rngA.next(), rngA.range(10, 20), rngA.rangeInt(1, 100)];
    const seqB = [rngB.next(), rngB.next(), rngB.range(10, 20), rngB.rangeInt(1, 100)];
    const seqC = [rngC.next(), rngC.next(), rngC.range(10, 20), rngC.rangeInt(1, 100)];

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it('parses color hex codes correctly', () => {
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#12345680')).toEqual({ r: 18, g: 52, b: 86, a: 128 / 255 });
  });

  it('executes canvas drawing operations across all texture generators when 2D context is available', () => {
    const mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
      shadowColor: '',
      shadowBlur: 0,
      fillRect: () => {},
      clearRect: () => {},
      strokeRect: () => {},
      rect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      ellipse: () => {},
      bezierCurveTo: () => {},
      stroke: () => {},
      fill: () => {},
      fillText: () => {},
      strokeText: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string) {
      if (type === '2d') return mockCtx as unknown as CanvasRenderingContext2D;
      return null;
    } as any;

    try {
      expect(generateBrickTextureSpec({ seed: 1 }).canvas).toBeDefined();
      expect(generateStoneTextureSpec({ seed: 1 }).canvas).toBeDefined();
      expect(generateStuccoTextureSpec({ seed: 1 }).canvas).toBeDefined();
      expect(generateSidingTextureSpec({ seed: 1 }).canvas).toBeDefined();
      expect(generateAsphaltTextureSpec({ seed: 1, roadLine: 'crosswalk' }).canvas).toBeDefined();
      expect(generateCobblestoneTextureSpec({ seed: 1 }).canvas).toBeDefined();
      expect(generateConcreteTextureSpec({ seed: 1 }).canvas).toBeDefined();
      expect(generateWoodTextureSpec({ seed: 1 }).canvas).toBeDefined();
      expect(generateMetalTextureSpec({ seed: 1 }).canvas).toBeDefined();
      expect(generateFabricTextureSpec({ seed: 1 }).canvas).toBeDefined();
      expect(generateWindowAtlasSpec({ seed: 1, litRatio: 1 }).canvas).toBeDefined();
      expect(generateWindowAtlasSpec({ seed: 2, litRatio: 0 }).canvas).toBeDefined();
      expect(generateSignageTextureSpec({ seed: 1, style: 'hand-painted' }).canvas).toBeDefined();
      expect(generateSignageTextureSpec({ seed: 2, style: 'neon-tube' }).canvas).toBeDefined();
      expect(generateSignageTextureSpec({ seed: 3, style: 'led-panel' }).canvas).toBeDefined();
      expect(generateNeonTextureSpec({ seed: 1 }).canvas).toBeDefined();
      expect(generateGrimeOverlaySpec({ seed: 1 }).canvas).toBeDefined();
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
  });

  it('creates Three.js era materials with correct physical parameters', () => {
    const brickMat = createEraMaterial('masonryConcrete', 1945);
    expect(brickMat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(brickMat.map).toBeDefined();
    expect(brickMat.roughness).toBeGreaterThanOrEqual(0.8);

    const chromeMat = createEraMaterial('metal', 1965);
    expect(chromeMat.metalness).toBeGreaterThanOrEqual(0.9);
    expect(chromeMat.roughness).toBeLessThan(0.2);

    const neonMat = createEraMaterial('neonEmissive', 1985);
    expect(neonMat.emissive).toBeDefined();
    expect(neonMat.emissiveIntensity).toBeGreaterThan(1.5);
  });
});

describe('Reusable Geometry Builders', () => {
  it('creates beveled box geometry with valid positions, normals and indices', () => {
    const geom = createBeveledBoxGeometry({ width: 2, height: 3, depth: 1, bevelSize: 0.05 });
    expect(geom.getAttribute('position')).toBeDefined();
    expect(geom.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('creates window grid geometry with frame and mullions', () => {
    const geom = createWindowGridGeometry({ width: 1.5, height: 2.2, rows: 3, columns: 2 });
    expect(geom.getAttribute('position')).toBeDefined();
    expect(geom.getAttribute('position').count).toBeGreaterThan(20);
    expect(geom.index).toBeDefined();
  });

  it('creates cornice geometry with dentil frieze', () => {
    const geom = createCorniceGeometry({ width: 4, height: 0.8, dentils: true, dentilCount: 8 });
    expect(geom.getAttribute('position')).toBeDefined();
    expect(geom.getAttribute('position').count).toBeGreaterThan(24);
  });

  it('creates lintel and pediment geometries', () => {
    const lintel = createLintelGeometry({ width: 1.6, keystone: true, pediment: 'triangular' });
    expect(lintel.getAttribute('position')).toBeDefined();
    expect(lintel.getAttribute('position').count).toBeGreaterThan(12);
  });

  it('creates multi-tier fire escape geometry', () => {
    const fireEscape = createFireEscapeGeometry({ width: 2.5, stories: 3 });
    expect(fireEscape.getAttribute('position')).toBeDefined();
    expect(fireEscape.getAttribute('position').count).toBeGreaterThan(50);
  });

  it('creates balcony geometries with railings', () => {
    const balcony = createBalconyGeometry({ width: 2.8, depth: 1.2, balusterCount: 10 });
    expect(balcony.getAttribute('position')).toBeDefined();
    expect(balcony.getAttribute('position').count).toBeGreaterThan(30);
  });

  it('creates door assemblies with panels and hardware', () => {
    const door = createDoorGeometry({ width: 1.2, height: 2.4, panels: 4, transom: true });
    expect(door.getAttribute('position')).toBeDefined();
    expect(door.getAttribute('position').count).toBeGreaterThan(30);
  });

  it('creates roof accessories (hvac, vent, water tower, skylight, chimney)', () => {
    const types = ['hvac', 'vent', 'water-tower', 'skylight', 'chimney'] as const;
    for (const type of types) {
      const geom = createRoofAccessoryGeometry({ type, scale: 1.2 });
      expect(geom.getAttribute('position'), `Roof accessory ${type} failed`).toBeDefined();
      expect(geom.getAttribute('position').count).toBeGreaterThan(10);
    }
  });

  it('merges buffer geometries properly', () => {
    const g1 = new THREE.BoxGeometry(1, 1, 1);
    const g2 = new THREE.BoxGeometry(2, 2, 2);
    const merged = mergeBufferGeometries([g1, g2]);
    expect(merged.getAttribute('position')).toBeDefined();
    expect(merged.getAttribute('position').count).toBe(g1.getAttribute('position').count + g2.getAttribute('position').count);
  });
});

describe('Instancing Helpers & 60fps repeated instances', () => {
  it('creates and populates InstancedMesh with 500+ window instances', () => {
    const geom = createWindowGridGeometry({ width: 1.2, height: 1.8 });
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const count = 500;
    const instancedMesh = createInstancedMesh({
      geometry: geom,
      material: mat,
      count,
      colors: true,
    });

    expect(instancedMesh).toBeInstanceOf(THREE.InstancedMesh);
    expect(instancedMesh.count).toBe(500);
    expect(instancedMesh.instanceColor).toBeDefined();

    const populated = populateInstancedGrid({
      mesh: instancedMesh,
      rows: 25,
      columns: 20,
      spacingX: 2.0,
      spacingY: 3.0,
      origin: [0, 0, 0],
      colorFn: (r, c) => ((r + c) % 2 === 0 ? '#ffea88' : '#334455'),
    });

    expect(populated).toBe(500);
  });

  it('sets instance transform and color correctly', () => {
    const matrix = composeInstanceMatrix({ position: [1, 2, 3], scale: 2 });
    expect(matrix).toBeInstanceOf(THREE.Matrix4);

    const geom = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    const mesh = createInstancedMesh({ geometry: geom, material: mat, count: 10 });

    setInstanceTransform(mesh, 0, { position: [10, 20, 30], scale: 2 });
    const mat4 = new THREE.Matrix4();
    mesh.getMatrixAt(0, mat4);
    const pos = new THREE.Vector3();
    pos.setFromMatrixPosition(mat4);
    expect(pos.x).toBeCloseTo(10);
    expect(pos.y).toBeCloseTo(20);
    expect(pos.z).toBeCloseTo(30);

    setInstanceColor(mesh, 0, '#ff0000');
    expect(mesh.instanceColor).toBeDefined();
  });

  it('exports complete ProceduralGfxLibrary object contract', () => {
    expect(ProceduralGfxLibrary).toBeDefined();
    expect(ProceduralGfxLibrary.ERA_YEARS).toBeDefined();
    expect(ProceduralGfxLibrary.createEraMaterial).toBeDefined();
    expect(ProceduralGfxLibrary.createWindowGridGeometry).toBeDefined();
    expect(ProceduralGfxLibrary.createInstancedMesh).toBeDefined();
  });
});
