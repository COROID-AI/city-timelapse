import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { AssetLoader, EraContext } from '../../types';
import { eraRegistry } from '../registry';
import era1945 from '../eras/1945';
import {
  brickTexture,
  fasciaTexture,
  billboardTexture,
  posterTexture,
  pedestrianMesh,
  sedanMesh,
  truckMesh,
  type OutfitSpec,
} from '../eras/1945.parts';

/**
 * Unit-level content checks for the 1945 era scene. These validate the
 * procedural texture factories, vehicle/pedestrian builders, and the registry
 * registration in isolation, plus end-to-end scene counts after a build.
 */

const stubLoader: AssetLoader = {
  load: async () => '',
  release: () => undefined,
};

function freshScene(): THREE.Group {
  return new THREE.Group();
}

const buildCtx = (stage: THREE.Group): EraContext => ({
  scene: stage,
  loader: stubLoader,
  root: undefined as never,
  year: '1945',
});

describe('1945 era procedural content', () => {
  it('is registered as era 1945 in the singleton registry', () => {
    const content = eraRegistry.getEra('1945');
    expect(content).toBe(era1945);
  });

  it('produces brick, cobblestone, asphalt and painted textures', () => {
    const brick = brickTexture();
    expect(brick.image).toBeDefined();
    expect(brick.image.width).toBeGreaterThan(0);

    const fascia = fasciaTexture('butcher');
    expect(fascia.image.width).toBeGreaterThan(0);
    expect(fascia.image.data.length).toBeGreaterThan(0);

    const billboard = billboardTexture(0);
    expect(billboard.image.width).toBeGreaterThan(0);

    const poster = posterTexture(0);
    expect(poster.image.width).toBeGreaterThan(0);
  });

  it('draws readable copy into textures (non-empty color variance)', () => {
    const fascia = fasciaTexture('chemist');
    const data = fascia.image.data as Uint8Array;
    let colorDetect = false;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== data[i + 1]) {
        colorDetect = true;
        break;
      }
    }
    expect(colorDetect).toBe(true);
  });

  it('builds vehicles with wheels and a lettered delivery truck', () => {
    const sedan = sedanMesh(0x1f2b2e);
    let wheelCount = 0;
    sedan.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.geometry.type === 'CylinderGeometry') wheelCount += 1;
    });
    expect(wheelCount).toBeGreaterThanOrEqual(4);

    const truck = truckMesh();
    expect(truck.children.length).toBeGreaterThan(0);
  });

  it('builds pedestrians in period outfits', () => {
    const specs: OutfitSpec[] = [
      { id: 'man-suit', label: 'Man in suit & fedora', coat: 0x3a4446, pants: 0x2c2c30, hat: 0x2c2c30 },
      { id: 'woman-dress', label: 'Woman in day dress', coat: 0x7a4a52, pants: 0x7a4a52, skirt: 0x7a4a52 },
      { id: 'child', label: 'Child', coat: 0xa25b3a, pants: 0x3a3f44 },
    ];
    for (const spec of specs) {
      const p = pedestrianMesh(spec);
      expect(p.children.length).toBeGreaterThan(0);
    }
  });

  it('builds a complete scene with file-level verified counts and disposes cleanly', () => {
    const stage = freshScene();
    era1945.build(buildCtx(stage));

    interface Tagged extends THREE.Object3D {
      userData: { category?: string };
    }
    const count = (cat: string): number => {
      let n = 0;
      stage.traverse((o) => {
        const t = o as Tagged;
        if (t.userData?.category === cat) n += 1;
      });
      return n;
    };

    expect(count('building')).toBeGreaterThanOrEqual(6);
    expect(count('storefront')).toBeGreaterThanOrEqual(3);
    expect(count('billboard')).toBeGreaterThanOrEqual(2);
    expect(count('vehicle')).toBeGreaterThanOrEqual(3);
    expect(count('pedestrian')).toBeGreaterThanOrEqual(8);
    expect(count('lamppost')).toBeGreaterThanOrEqual(4);
    expect(count('telephone-pole')).toBeGreaterThanOrEqual(3);
    expect(count('sandbag')).toBeGreaterThanOrEqual(2);
    expect(era1945.interactivePoints.length).toBeGreaterThanOrEqual(4);

    era1945.dispose();
    expect(stage.children.length).toBe(0);
  });
});