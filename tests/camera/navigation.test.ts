import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  createCameraRig,
  easeInOutCubic,
  easeInOutQuad,
  calculateBumperPush,
  checkBuildingCollision,
  resolveBuildingCollision,
  sampleBuildingShellBounds,
} from '../../src/camera/cameraRig';
import {
  createPoiCatalog,
  findPoiById,
  findPoiByNumber,
  findNearestPoi,
} from '../../src/camera/poiCatalog';
import { createCityBlockLayout } from '../../src/layout/cityBlockLayout';

describe('POI Catalog and Queries', () => {
  it('generates a populated catalog with numbered points of interest', () => {
    const catalog = createPoiCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(5);

    // Assert sequential numbering and structure
    for (let i = 0; i < catalog.length; i++) {
      const poi = catalog[i];
      expect(poi.id).toBeTruthy();
      expect(poi.number).toBe(i + 1);
      expect(poi.name).toBeTruthy();
      expect(poi.description).toBeTruthy();
      expect(poi.position).toBeDefined();
      expect(poi.lookAt).toBeDefined();
      expect(typeof poi.position.x).toBe('number');
      expect(typeof poi.position.y).toBe('number');
      expect(typeof poi.position.z).toBe('number');
    }
  });

  it('can query POIs by id and by number', () => {
    const catalog = createPoiCatalog();
    const poi1 = findPoiByNumber(catalog, 1);
    expect(poi1).toBeDefined();
    expect(poi1?.number).toBe(1);

    const poiById = findPoiById(catalog, poi1!.id);
    expect(poiById).toEqual(poi1);

    expect(findPoiByNumber(catalog, 999)).toBeUndefined();
    expect(findPoiById(catalog, 'unknown-id')).toBeUndefined();
  });

  it('finds the nearest POI to given coordinates', () => {
    const catalog = createPoiCatalog();
    const first = catalog[0];
    const nearest = findNearestPoi(catalog, {
      x: first.position.x + 0.1,
      y: first.position.y,
      z: first.position.z + 0.1,
    });
    expect(nearest?.id).toBe(first.id);
  });
});

describe('Easing Mathematics', () => {
  it('easeInOutCubic starts at 0, ends at 1, and is monotonic and symmetric', () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0, 5);
    expect(easeInOutCubic(1)).toBeCloseTo(1, 5);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);

    // Monotonicity check
    let prev = -1;
    for (let t = 0; t <= 1; t += 0.05) {
      const val = easeInOutCubic(t);
      expect(val).toBeGreaterThanOrEqual(prev);
      prev = val;
    }

    // Clamping outside [0, 1]
    expect(easeInOutCubic(-0.5)).toBe(0);
    expect(easeInOutCubic(1.5)).toBe(1);
  });

  it('easeInOutQuad starts at 0, ends at 1, and is smooth', () => {
    expect(easeInOutQuad(0)).toBeCloseTo(0, 5);
    expect(easeInOutQuad(1)).toBeCloseTo(1, 5);
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe('Edge Bumpers & Soft Push-Back', () => {
  const bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
  const margin = 10;
  const strength = 30;

  it('produces zero push-back in the safe center zone', () => {
    const push = calculateBumperPush({ x: 0, z: 0 }, bounds, margin, strength);
    expect(push.pushX).toBe(0);
    expect(push.pushZ).toBe(0);
  });

  it('produces soft inward push when approaching minX boundary', () => {
    // Within margin of minX (-50 + 10 = -40)
    const push = calculateBumperPush({ x: -45, z: 0 }, bounds, margin, strength);
    expect(push.pushX).toBeGreaterThan(0); // Pushes towards positive X (inward)
    expect(push.pushZ).toBe(0);

    // Closer to edge produces stronger push (non-linear)
    const pushDeeper = calculateBumperPush({ x: -49, z: 0 }, bounds, margin, strength);
    expect(pushDeeper.pushX).toBeGreaterThan(push.pushX);
  });

  it('produces soft inward push when approaching all boundary edges', () => {
    const pushEast = calculateBumperPush({ x: 45, z: 0 }, bounds, margin, strength);
    expect(pushEast.pushX).toBeLessThan(0); // Pushes west

    const pushNorth = calculateBumperPush({ x: 0, z: -45 }, bounds, margin, strength);
    expect(pushNorth.pushZ).toBeGreaterThan(0); // Pushes south

    const pushSouth = calculateBumperPush({ x: 0, z: 45 }, bounds, margin, strength);
    expect(pushSouth.pushZ).toBeLessThan(0); // Pushes north
  });
});

describe('Building Footprint Collision Sampling', () => {
  const layout = createCityBlockLayout();
  const shells = sampleBuildingShellBounds(layout);

  it('detects collision inside building shell footprint below building height', () => {
    const lot0Shell = shells[0];
    const insidePoint = {
      x: lot0Shell.rect.origin.x + lot0Shell.rect.width / 2,
      y: lot0Shell.height / 2,
      z: lot0Shell.rect.origin.z + lot0Shell.rect.depth / 2,
    };

    expect(checkBuildingCollision(insidePoint, shells, 1.0)).toBe(true);
  });

  it('does not detect collision above building roof or in the street', () => {
    const lot0Shell = shells[0];
    const aboveRoof = {
      x: lot0Shell.rect.origin.x + lot0Shell.rect.width / 2,
      y: lot0Shell.height + 5,
      z: lot0Shell.rect.origin.z + lot0Shell.rect.depth / 2,
    };

    expect(checkBuildingCollision(aboveRoof, shells, 1.0)).toBe(false);

    // Free street area
    const streetPoint = {
      x: layout.streets[0].rect.origin.x + 2,
      y: 5,
      z: layout.streets[0].rect.origin.z + 2,
    };
    expect(checkBuildingCollision(streetPoint, shells, 1.0)).toBe(false);
  });

  it('resolves collision by pushing camera outside shell footprint', () => {
    const lot0Shell = shells[0];
    const insidePoint = {
      x: lot0Shell.rect.origin.x + 0.5,
      y: 4,
      z: lot0Shell.rect.origin.z + lot0Shell.rect.depth / 2,
    };

    const resolved = resolveBuildingCollision(insidePoint, shells, 1.2);
    expect(checkBuildingCollision(resolved, shells, 1.0)).toBe(false);
  });
});

describe('Polished CameraRig Integration', () => {
  const layout = createCityBlockLayout();
  const camera = new PerspectiveCamera(55, 1.0);

  it('implements the core CameraRig contract used by overlay chrome and bootstrap', () => {
    const rig = createCameraRig(camera, layout.bounds, { layout });

    expect(typeof rig.update).toBe('function');
    expect(typeof rig.look).toBe('function');
    expect(typeof rig.setJoystick).toBe('function');
    expect(typeof rig.startOrbit).toBe('function');
    expect(typeof rig.stopOrbit).toBe('function');
    expect(typeof rig.toggleOrbit).toBe('function');
    expect(typeof rig.dispose).toBe('function');
    expect(rig.orbiting).toBe(false);
    expect(rig.position instanceof Vector3).toBe(true);
    expect(rig.mode).toBe('free-fly');

    rig.dispose();
  });

  it('handles orbit mode circular path, altitude adjustment, and auto-rotate', () => {
    const rig = createCameraRig(camera, layout.bounds, { layout });

    rig.startOrbit();
    expect(rig.orbiting).toBe(true);
    expect(rig.mode).toBe('orbit');

    rig.setOrbitHeight(35);
    expect(rig.orbitHeight).toBe(35);

    rig.setOrbitRadius(45);
    expect(rig.orbitRadius).toBe(45);

    // Step simulation
    rig.update(0.5);

    expect(rig.position.y).toBe(35);
    // Position should match circle radius
    expect(Math.hypot(rig.position.x, rig.position.z)).toBeCloseTo(45, 1);

    rig.stopOrbit();
    expect(rig.orbiting).toBe(false);
    expect(rig.mode).toBe('free-fly');

    rig.dispose();
  });

  it('performs smooth fly-to transition towards a POI', () => {
    const rig = createCameraRig(camera, layout.bounds, { layout });
    const pois = rig.poiCatalog;
    expect(pois.length).toBeGreaterThan(0);

    const targetPoi = pois[1];
    const success = rig.flyToPoi(targetPoi.id, 1.0);
    expect(success).toBe(true);
    expect(rig.isFlying).toBe(true);
    expect(rig.mode).toBe('fly-to');

    // Advance halfway
    rig.update(0.5);
    expect(rig.isFlying).toBe(true);

    // Advance to end
    rig.update(0.6);
    expect(rig.isFlying).toBe(false);
    expect(rig.position.x).toBeCloseTo(targetPoi.position.x, 0.1);
    expect(rig.position.y).toBeCloseTo(targetPoi.position.y, 0.1);
    expect(rig.position.z).toBeCloseTo(targetPoi.position.z, 0.1);

    rig.dispose();
  });

  it('supports touch pinch zoom and drag look tuning with inertia damping', () => {
    const rig = createCameraRig(camera, layout.bounds, { layout });

    const initialY = rig.position.y;
    rig.zoom(-1.0); // zoom forward
    expect(rig.position.y).not.toBe(initialY);

    const initialYaw = rig.yaw;
    rig.look(50, 20);
    expect(rig.yaw).not.toBe(initialYaw);

    // Update with dt to observe inertia damping
    rig.update(0.1);
    rig.update(0.5);

    rig.dispose();
  });
});
