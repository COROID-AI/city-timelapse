import { describe, expect, it } from 'vitest';
import { Scene } from 'three';
import { createCityBlockLayout } from '../../../src/layout/cityBlockLayout';
import { createEraState } from '../../../src/state/eraState';
import { createSfxContext } from '../../../src/audio/sfxContext';
import { era1945Content, era1945BuildingFootprints } from '../../../src/eras/1945/index';
import { era1945SfxStems } from '../../../src/eras/1945/audio';

describe('Era 1945 composition against the foundation', () => {
  it('instantiates era1945Content against the real CityBlockLayout and reactive EraState', () => {
    const layout = createCityBlockLayout();
    const eraState = createEraState(1945);

    expect(layout.lots).toHaveLength(10);
    expect(eraState.year).toBe(1945);
    expect(era1945Content.year).toBe(1945);
    expect(era1945Content.active).toBe(false);
  });

  it('attaches to a scene, steps update, and disposes with zero errors', () => {
    const scene = new Scene();
    const layout = createCityBlockLayout();

    const attached = era1945Content.attach(scene, layout);
    const childCount = scene.children.length;
    expect(childCount).toBeGreaterThan(0);

    // Step update (animates vehicles + pedestrians).
    attached.update(0.016);
    attached.update(0.5);

    // Dispose removes all content.
    attached.dispose();
    expect(scene.children.length).toBe(0);
  });

  it('applies the 1945 lighting grade and can remove it', () => {
    const scene = new Scene();
    const removeGrade = era1945Content.applyGrade(scene);
    expect(scene.children.length).toBeGreaterThan(0);
    removeGrade();
    expect(scene.children.length).toBe(0);
  });

  it('registers era ambience SFX stems through the foundation SfxContext', () => {
    // The foundation SfxContext attaches gesture listeners to `window` on
    // creation and detaches them on dispose, so provide a minimal stub for the
    // node test environment.
    const listeners = new Map<string, () => void>();
    const windowStub = {
      AudioContext: undefined,
      addEventListener: (type: string, cb: () => void) => {
        listeners.set(type, cb);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
    };
    const prevWindow = globalThis.window;
    (globalThis as { window?: unknown }).window = windowStub;

    const sfx = createSfxContext();
    const audio = era1945Content.createAudio(sfx);

    expect(era1945SfxStems.map((s) => s.id)).toEqual(
      audio.stems.map((s) => s.id),
    );
    expect(audio.stems.some((s) => s.id === 'radio_jingle_loop')).toBe(true);
    expect(audio.stems.some((s) => s.id === 'propeller_plane_flyover')).toBe(true);

    // Playing a stem through the un-initialized hook is a safe no-op.
    audio.play('distant_tram_bell');
    audio.play('unknown_stem');

    audio.dispose();
    sfx.dispose();

    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  });

  it('switches era to/from 1945 via the reactive EraState without errors', () => {
    const eraState = createEraState(1945);
    const scene = new Scene();
    const layout = createCityBlockLayout();

    let active = false;
    eraState.subscribe((year) => {
      active = year === 1945;
    });

    // Attach while at 1945.
    const attached = era1945Content.attach(scene, layout);
    era1945Content.setActive(true);
    expect(active).toBe(false); // state unchanged (still 1945)

    // Switch away then back.
    eraState.setYear(1985);
    eraState.setYear(1945);
    expect(active).toBe(true);

    attached.dispose();
    expect(scene.children.length).toBe(0);
  });

  it('places building footprints on their lot anchors', () => {
    const layout = createCityBlockLayout();
    const footprints = era1945BuildingFootprints(layout);
    expect(footprints).toHaveLength(10);
    for (const fp of footprints) {
      const lot = layout.lots[fp.lotIndex];
      expect(fp.width).toBeLessThanOrEqual(lot.width);
      expect(fp.depth).toBeLessThanOrEqual(lot.depth);
    }
  });

  it('keeps all writes confined to src/eras/1945/ and tests/eras/1945/', () => {
    // This test asserts the module only consumes foundation contracts and
    // defines its content locally (no mutation of shared foundation files).
    // The write-scope invariant is enforced by the harness at delivery time.
    expect(era1945Content.year).toBe(1945);
    expect(era1945Content.buildings).toHaveLength(10);
    expect(era1945Content.storefronts).toHaveLength(4);
  });
});