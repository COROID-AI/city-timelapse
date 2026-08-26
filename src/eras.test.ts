import { describe, it, expect } from 'vitest';
import {
  ERA_IDS,
  ERA_REGISTRY,
  eraConfigs,
  getEraSpec,
  getEraConfig,
  eraIndex,
  SFX_ERA_DATA,
  type EraId,
} from './eras';

const EXPECTED_ERAS: readonly EraId[] = ['1945', '1965', '1985', '2005', '2025'];

describe('era contract', () => {
  it('covers exactly the five eras in timeline order', () => {
    expect(ERA_IDS).toEqual(EXPECTED_ERAS);
    expect(ERA_IDS).toHaveLength(5);
  });

  it('has exactly the five eras in eraConfigs, keyed by the same ids', () => {
    expect(Object.keys(eraConfigs).sort()).toEqual(
      [...EXPECTED_ERAS].sort(),
    );
    for (const id of ERA_IDS) {
      expect(eraConfigs[id].id).toBe(id);
    }
  });

  it('registers a spec for every era', () => {
    expect(ERA_REGISTRY.map((s) => s.id)).toEqual(EXPECTED_ERAS);
    for (const id of ERA_IDS) {
      expect(getEraSpec(id).id).toBe(id);
    }
  });

  it('populates every config category for each era', () => {
    for (const id of ERA_IDS) {
      const cfg = eraConfigs[id];
      expect(cfg.buildings.facadePalette.length).toBeGreaterThan(0);
      expect(cfg.buildings.facadeMaterial.length).toBeGreaterThan(0);
      expect(cfg.buildings.rooftopProps.length).toBeGreaterThan(0);
      expect(cfg.vehicles.types.length).toBeGreaterThan(0);
      expect(cfg.storefronts.awningColors.length).toBeGreaterThan(0);
      expect(cfg.advertisements.examples.length).toBeGreaterThan(0);
      expect(cfg.pedestrians.outfitPalettes.length).toBeGreaterThan(0);
      expect(cfg.lighting.lampType.length).toBeGreaterThan(0);
      expect(cfg.atmosphere.ambientSfxProfile.length).toBeGreaterThan(0);
    }
  });

  it('provides distinct sound parameters for every era', () => {
    expect(Object.keys(SFX_ERA_DATA).sort()).toEqual(
      [...EXPECTED_ERAS].sort(),
    );
    for (const id of ERA_IDS) {
      const data = SFX_ERA_DATA[id];
      expect(data.droneHz).toBeGreaterThan(0);
      expect(data.noiseFilterHz).toBeGreaterThan(0);
      expect(data.events.length).toBeGreaterThan(0);
      expect(data.musicStyle.length).toBeGreaterThan(0);
    }
  });

  it('looks up configs by id and index consistently', () => {
    for (const [idx, id] of ERA_IDS.entries()) {
      expect(eraIndex(id)).toBe(idx);
      expect(getEraConfig(id).id).toBe(id);
    }
  });
});
