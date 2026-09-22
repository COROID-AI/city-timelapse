import { describe, expect, it } from 'vitest';
import { createCityScene, createOverlayRoot, OVERLAY_ROOT_ID } from './shell';

describe('app shell scaffold', () => {
  it('builds a lit scene with an empty cityRoot group and a ground plane', () => {
    const { scene, cityRoot, ground } = createCityScene();

    expect(cityRoot.name).toBe('cityRoot');
    expect(cityRoot.type).toBe('Group');
    expect(cityRoot.children).toHaveLength(0);
    expect(scene.getObjectByName('cityRoot')).toBe(cityRoot);

    expect(ground.name).toBe('ground');
    expect(scene.children).toContain(ground);
    expect(ground.receiveShadow).toBe(true);

    const lights = scene.children.filter((child) => (child as { isLight?: boolean }).isLight === true);
    expect(lights.length).toBeGreaterThanOrEqual(2);
    const shadowsReady = lights.some(
      (child) => (child as { castShadow?: boolean }).castShadow === true,
    );
    expect(shadowsReady).toBe(true);
  });

  it('mounts the fixed top UI overlay root with a timeline slot', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const overlay = createOverlayRoot(host);

    expect(overlay.id).toBe(OVERLAY_ROOT_ID);
    expect(host.contains(overlay)).toBe(true);
    expect(overlay.querySelector('[data-timeline-slot]')).not.toBeNull();
    expect(overlay.classList.contains('ui-overlay')).toBe(true);
    expect(overlay.querySelector('.timeline-slot')).not.toBeNull();

    overlay.remove();
    host.remove();
  });
});
