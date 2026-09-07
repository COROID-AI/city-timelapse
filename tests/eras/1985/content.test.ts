import { describe, expect, it } from 'vitest';
import { createCityBlockLayout } from '../../../src/layout/cityBlockLayout';
import { create1985Buildings } from '../../../src/eras/1985/buildings';
import { create1985Storefronts } from '../../../src/eras/1985/storefronts';
import { create1985Ads } from '../../../src/eras/1985/ads';
import { create1985Vehicles } from '../../../src/eras/1985/vehicles';
import { create1985StreetFurniture } from '../../../src/eras/1985/streetFurniture';
import { create1985Pedestrians } from '../../../src/eras/1985/pedestrians';
import { PALETTE_1985, compute1985LightingGrade } from '../../../src/eras/1985/palette';
import { create1985Audio } from '../../../src/eras/1985/audio';
import { createEra1985Content, era1985Content } from '../../../src/eras/1985/index';

describe('Era 1985 Content Module', () => {
  const layout = createCityBlockLayout();

  describe('Buildings', () => {
    it('creates buildings for all 10 lot anchors', () => {
      const buildings = create1985Buildings(layout.lots);
      expect(buildings.buildings).toHaveLength(10);
      expect(buildings.root.children.length).toBe(10);
    });

    it('creates the mirrored glass high-rise tower', () => {
      const buildings = create1985Buildings(layout.lots);
      expect(buildings.highRiseMesh).toBeDefined();
      expect(buildings.highRiseMesh.children.length).toBeGreaterThan(5);
    });

    it('creates parking lot infill where older buildings were demolished', () => {
      const buildings = create1985Buildings(layout.lots);
      expect(buildings.parkingLot).toBeDefined();
      expect(buildings.parkingLot.children.length).toBeGreaterThan(3);
    });
  });

  describe('Storefronts', () => {
    it('creates all 5 required 1985 storefronts', () => {
      const sf = create1985Storefronts(layout.lots);
      expect(sf.videoStore).toBeDefined();
      expect(sf.arcade).toBeDefined();
      expect(sf.newsstand).toBeDefined();
      expect(sf.deli).toBeDefined();
      expect(sf.recordShop).toBeDefined();
    });
  });

  describe('Advertisements', () => {
    it('creates rooftop backlit billboard and street flyers', () => {
      const ads = create1985Ads(layout.lots);
      expect(ads.mainBillboard).toBeDefined();
      expect(ads.mainBillboard.children.length).toBeGreaterThan(4);
      expect(ads.flyersAndStickers.length).toBeGreaterThanOrEqual(10);
      expect(ads.boomboxAds.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Vehicles', () => {
    it('creates boxy sedans, station wagon, yellow taxi, box van, and motorcycle', () => {
      const v = create1985Vehicles(layout);
      expect(v.vehicles.length).toBeGreaterThanOrEqual(5);
      const types = v.vehicles.map((veh) => veh.type);
      expect(types).toContain('taxi');
      expect(types).toContain('sedan');
      expect(types).toContain('wagon');
      expect(types).toContain('van');
      expect(types).toContain('motorcycle');
      expect(v.parkedVehicles.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Street Furniture', () => {
    it('creates cobra-head street lights, bus stop, phone booth, trash cans, and meters', () => {
      const sf = create1985StreetFurniture(layout);
      expect(sf.cobraLights.length).toBe(8);
      expect(sf.busStop).toBeDefined();
      expect(sf.phoneBooth).toBeDefined();
      expect(sf.trashCans.length).toBe(4);
      expect(sf.parkingMeters.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Pedestrians', () => {
    it('creates diverse 1985 pedestrians (power suits, punks, breakdancers, joggers, boombox)', () => {
      const p = create1985Pedestrians(layout);
      expect(p.pedestrians.length).toBeGreaterThanOrEqual(15);
      expect(p.businesspeople.length).toBeGreaterThanOrEqual(3);
      expect(p.punks.length).toBeGreaterThanOrEqual(3);
      expect(p.breakdancers.length).toBeGreaterThanOrEqual(2);
      expect(p.joggers.length).toBeGreaterThanOrEqual(2);
      expect(p.boomboxCarriers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Palette & Lighting Grade', () => {
    it('defines the 1985 palette with smog daylight and sodium/neon night', () => {
      expect(PALETTE_1985.year).toBe(1985);
      expect(PALETTE_1985.day.smogHaze).toBeTruthy();
      expect(PALETTE_1985.night.sodiumGlow).toBeTruthy();
      expect(PALETTE_1985.night.neonMagenta).toBeTruthy();
      expect(PALETTE_1985.night.neonCyan).toBeTruthy();
    });

    it('computes lighting grade shifting between smoggy day and sodium night', () => {
      const dayGrade = compute1985LightingGrade(0.5);
      const nightGrade = compute1985LightingGrade(0.0);
      expect(dayGrade.sunIntensity).toBeGreaterThan(nightGrade.sunIntensity);
      expect(nightGrade.sodiumGlowIntensity).toBeGreaterThan(dayGrade.sodiumGlowIntensity);
      expect(nightGrade.neonIntensity).toBeGreaterThan(dayGrade.neonIntensity);
    });
  });

  describe('Audio & SFX Stems', () => {
    it('registers all required 1985 SFX stems', () => {
      const audio = create1985Audio();
      expect(audio.stemNames).toContain('synthPopRadio');
      expect(audio.stemNames).toContain('arcadeBeeps');
      expect(audio.stemNames).toContain('coinDrop');
      expect(audio.stemNames).toContain('heavyTraffic');
      expect(audio.stemNames).toContain('taxiHorn');
      expect(audio.stemNames).toContain('helicopterFlyover');
      expect(audio.stemNames).toContain('subwayRumble');

      // Test playing stems without crashing in headless environment
      expect(() => {
        audio.playStem('synthPopRadio');
        audio.playStem('arcadeBeeps');
        audio.playStem('coinDrop');
        audio.playStem('heavyTraffic');
        audio.playStem('taxiHorn');
        audio.playStem('helicopterFlyover');
        audio.playStem('subwayRumble');
      }).not.toThrow();

      audio.dispose();
    });
  });

  describe('EraContent root object', () => {
    it('implements the complete EraContent contract', () => {
      const content = createEra1985Content(layout);
      expect(content.year).toBe(1985);
      expect(content.group).toBeDefined();
      expect(content.root).toBeDefined();
      expect(content.palette).toBe(PALETTE_1985);

      // Steps update
      expect(() => content.update(0.016, 0.5)).not.toThrow();
      expect(() => content.dispose()).not.toThrow();
    });

    it('exports default era1985Content instance', () => {
      expect(era1985Content).toBeDefined();
      expect(era1985Content.year).toBe(1985);
    });
  });
});
