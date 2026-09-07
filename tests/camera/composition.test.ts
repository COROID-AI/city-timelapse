import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { execSync } from 'node:child_process';
import { createCameraRig, calculateBumperPush } from '../../src/camera/cameraRig';
import { createCityBlockLayout, createDefaultBuildingShells } from '../../src/layout/cityBlockLayout';
import { createEraState } from '../../src/state/eraState';

describe('CameraRig Composition & Scope Verification', () => {
  it('wires the polished CameraRig with real CityBlockLayout and EraState', () => {
    const eraState = createEraState(1945);
    const layout = createCityBlockLayout();
    const shells = createDefaultBuildingShells(layout, eraState.year);
    const camera = new PerspectiveCamera(55, 1.0);

    const rig = createCameraRig(camera, layout.bounds, {
      layout,
      shells,
      bumperMargin: 6,
    });

    expect(rig.orbiting).toBe(false);
    expect(rig.mode).toBe('free-fly');

    // Subscribe to eraState change and update shells
    eraState.subscribe((year) => {
      const updatedShells = createDefaultBuildingShells(layout, year);
      rig.setBuildingShells(updatedShells);
    });

    eraState.setYear(1985);
    expect(eraState.year).toBe(1985);
    expect(rig.buildingShells).toHaveLength(10);
    expect(rig.buildingShells[0].era).toBe(1985);

    rig.dispose();
  });

  it('glides camera to a POI with smooth look-at easing during fly-to', () => {
    const layout = createCityBlockLayout();
    const camera = new PerspectiveCamera(55, 1.0);
    const rig = createCameraRig(camera, layout.bounds, { layout });

    const poi = rig.poiCatalog[0];
    const initialPosX = rig.position.x;

    rig.flyTo(poi.position, poi.lookAt, 1.0);
    expect(rig.isFlying).toBe(true);
    expect(rig.mode).toBe('fly-to');

    // Step halfway
    rig.update(0.5);
    expect(rig.position.x).not.toBe(initialPosX);
    expect(rig.position.x).not.toBe(poi.position.x);

    // Complete fly-to
    rig.update(0.6);
    expect(rig.isFlying).toBe(false);
    expect(rig.position.x).toBeCloseTo(poi.position.x, 0.1);
    expect(rig.position.y).toBeCloseTo(poi.position.y, 0.1);
    expect(rig.position.z).toBeCloseTo(poi.position.z, 0.1);

    rig.dispose();
  });

  it('engages soft edge bumpers at block boundaries', () => {
    const layout = createCityBlockLayout();
    const camera = new PerspectiveCamera(55, 1.0);
    const rig = createCameraRig(camera, layout.bounds, { layout, bumperMargin: 8, bumperStrength: 40 });

    // Place camera right next to west boundary
    rig.position.x = layout.bounds.minX + 2;
    rig.position.z = 0;

    const push = calculateBumperPush(
      { x: rig.position.x, z: rig.position.z },
      layout.bounds,
      8,
      40,
    );
    expect(push.pushX).toBeGreaterThan(0);

    // Update simulation: camera should be pushed inward
    const prevX = rig.position.x;
    rig.update(0.1);
    expect(rig.position.x).toBeGreaterThan(prevX);

    rig.dispose();
  });

  it('samples building footprints and prevents camera from entering building interiors', () => {
    const layout = createCityBlockLayout();
    const eraState = createEraState(1945);
    const shells = createDefaultBuildingShells(layout, eraState.year);
    const camera = new PerspectiveCamera(55, 1.0);
    const rig = createCameraRig(camera, layout.bounds, { layout, shells });

    // Attempt to position camera inside Lot 0 shell
    const shell0 = shells[0];
    const insidePoint = {
      x: shell0.rect.origin.x + shell0.rect.width / 2,
      y: shell0.height / 2,
      z: shell0.rect.origin.z + shell0.rect.depth / 2,
    };

    rig.position.set(insidePoint.x, insidePoint.y, insidePoint.z);
    rig.update(0.016);

    // Camera position must have been resolved outside the shell
    const minX = shell0.rect.origin.x - 1.0;
    const maxX = shell0.rect.origin.x + shell0.rect.width + 1.0;
    const minZ = shell0.rect.origin.z - 1.0;
    const maxZ = shell0.rect.origin.z + shell0.rect.depth + 1.0;

    const stillInside =
      rig.position.x > minX &&
      rig.position.x < maxX &&
      rig.position.z > minZ &&
      rig.position.z < maxZ;

    expect(stillInside).toBe(false);

    rig.dispose();
  });

  it('maintains the existing mode API (orbiting, startOrbit, stopOrbit) for overlay chrome', () => {
    const layout = createCityBlockLayout();
    const camera = new PerspectiveCamera(55, 1.0);
    const rig = createCameraRig(camera, layout.bounds);

    expect(rig.orbiting).toBe(false);
    rig.startOrbit();
    expect(rig.orbiting).toBe(true);
    rig.stopOrbit();
    expect(rig.orbiting).toBe(false);

    rig.dispose();
  });

  it('confines modified files strictly to src/camera/ and tests/camera/', () => {
    // Check git status to ensure no unintended files were modified
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    const lines = status.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const filePath = line.trim().replace(/^[MADRCU?! ]+\s+/, '');
      const valid =
        filePath.startsWith('src/camera/') ||
        filePath.startsWith('tests/camera/');
      expect(
        valid,
        `File outside task scope was modified or created: ${filePath}`,
      ).toBe(true);
    }
  });
});
