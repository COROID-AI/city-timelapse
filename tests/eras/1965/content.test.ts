import { describe, expect, it } from 'vitest';
import { createCityBlockLayout } from '../../../src/layout/cityBlockLayout';
import { ERA_1965_PALETTE } from '../../../src/eras/1965/palette';
import { BILLBOARD_ARTWORKS_1965, STOREFRONT_SIGNS_1965 } from '../../../src/eras/1965/textures';
import { create1965Buildings } from '../../../src/eras/1965/buildings';
import {
  createApplianceStorefront,
  createDinerStorefront,
  createLaundromatStorefront,
  createRecordStorefront,
  createTobacconistStorefront,
} from '../../../src/eras/1965/storefronts';
import { create1965Ads, createRooftopBillboard, createNeonSigns } from '../../../src/eras/1965/ads';
import {
  create1965Vehicles,
  createCompactBeetle,
  createConvertible,
  createDeliveryVan,
  createFinnedSedan,
} from '../../../src/eras/1965/vehicles';
import {
  create1965StreetFurniture,
  createBusShelter,
  createModernistDoubleLamp,
  createParkingMeter,
  createPhoneBooth,
  createTrashCan,
} from '../../../src/eras/1965/streetFurniture';
import {
  create1965Pedestrians,
  createModPedestrian,
  createShiftDressPedestrian,
  createSlimSuitPedestrian,
  createTeenTransistorPedestrian,
} from '../../../src/eras/1965/pedestrians';
import { create1965Audio } from '../../../src/eras/1965/audio';
import { SfxContext } from '../../../src/audio/sfxContext';

describe('1965 Era Content Module Unit Tests', () => {
  const layout = createCityBlockLayout();

  describe('Palette & Lighting Grade', () => {
    it('declares 1965 saturated Technicolor grade and atmosphere', () => {
      expect(ERA_1965_PALETTE.year).toBe(1965);
      expect(ERA_1965_PALETTE.grading.saturation).toBeGreaterThan(1.0);
      expect(ERA_1965_PALETTE.grading.skyHaze.r).toBeDefined();
      expect(ERA_1965_PALETTE.grading.coolFluorescent.b).toBeGreaterThan(0.9);
      expect(ERA_1965_PALETTE.grading.warmNeon.r).toBe(1.0);
    });

    it('declares signature mid-century modern architectural facade colors', () => {
      expect(ERA_1965_PALETTE.architecture.renovatedEnamelAqua).toBe(0x2ec4b6);
      expect(ERA_1965_PALETTE.architecture.renovatedEnamelYellow).toBe(0xffd166);
      expect(ERA_1965_PALETTE.architecture.googieCanopyWhite).toBeDefined();
      expect(ERA_1965_PALETTE.architecture.curtainWallGlass).toBeDefined();
    });
  });

  describe('Textures & Signage', () => {
    it('provides period billboard artworks for cars, cigarettes, airlines, and CRT TVs', () => {
      expect(BILLBOARD_ARTWORKS_1965.length).toBeGreaterThanOrEqual(4);
      const categories = BILLBOARD_ARTWORKS_1965.map((a) => a.category);
      expect(categories).toContain('car');
      expect(categories).toContain('cigarette');
      expect(categories).toContain('airline');
      expect(categories).toContain('television');
    });

    it('provides plastic illuminated sign bands for storefronts', () => {
      expect(STOREFRONT_SIGNS_1965.length).toBeGreaterThanOrEqual(5);
      const titles = STOREFRONT_SIGNS_1965.map((s) => s.title);
      expect(titles.some((t) => t.includes('DINER'))).toBe(true);
      expect(titles.some((t) => t.includes('RECORDS'))).toBe(true);
      expect(titles.some((t) => t.includes('HI-FI'))).toBe(true);
    });
  });

  describe('Architecture & 10 Lots Placement', () => {
    it('creates 10 distinct buildings on the 10 lot anchors', () => {
      const { buildings, root } = create1965Buildings(layout);
      expect(buildings).toHaveLength(10);
      expect(root.children).toHaveLength(10);

      for (let i = 0; i < 10; i++) {
        expect(buildings[i].lotIndex).toBe(i);
        expect(buildings[i].root).toBeDefined();
        expect(buildings[i].height).toBeGreaterThan(0);
      }
    });

    it('features the corner Googie diner on lot 0 with upward canopy', () => {
      const { buildings } = create1965Buildings(layout);
      const diner = buildings[0];
      expect(diner.style).toBe('googie_diner');
      expect(diner.name).toContain('Diner');
      expect(diner.storefront?.kind).toBe('diner');
    });

    it('features glass curtain-wall infill and renovated enamel buildings', () => {
      const { buildings } = create1965Buildings(layout);
      const styles = buildings.map((b) => b.style);
      expect(styles).toContain('glass_curtain_wall');
      expect(styles).toContain('renovated_enamel');
      expect(styles).toContain('renovated_brick');
    });
  });

  describe('Storefront Subsystems', () => {
    it('implements Television & Appliance shop with glowing CRT display', () => {
      const tvShop = createApplianceStorefront();
      expect(tvShop.kind).toBe('appliance_tv');
      expect(tvShop.root.children.length).toBeGreaterThan(5);
      tvShop.update(0.016, 1.0);
    });

    it('implements Record store with vinyl record window displays', () => {
      const recordStore = createRecordStorefront();
      expect(recordStore.kind).toBe('record_store');
      expect(recordStore.root.children.length).toBeGreaterThan(5);
      recordStore.update(0.016, 1.0);
    });

    it('implements Diner with booth seating, counter stools, and jukebox glow', () => {
      const diner = createDinerStorefront();
      expect(diner.kind).toBe('diner');
      expect(diner.root.children.length).toBeGreaterThan(5);
      diner.update(0.016, 1.0);
    });

    it('implements Tobacconist with display cases and humidor', () => {
      const tobacconist = createTobacconistStorefront();
      expect(tobacconist.kind).toBe('tobacconist');
      expect(tobacconist.root.children.length).toBeGreaterThan(3);
    });

    it('implements Laundromat with front-loading washers visible through glass', () => {
      const laundry = createLaundromatStorefront();
      expect(laundry.kind).toBe('laundromat');
      expect(laundry.root.children.length).toBeGreaterThan(5);
      laundry.update(0.016, 1.0);
    });
  });

  describe('Advertisements, Billboards & Neon', () => {
    it('constructs rooftop billboard with steel truss and graphics', () => {
      const billboard = createRooftopBillboard();
      expect(billboard.children.length).toBeGreaterThan(4);
    });

    it('constructs flickering neon window signs', () => {
      const { group, signs } = createNeonSigns();
      expect(group.children.length).toBeGreaterThanOrEqual(4);
      expect(signs.length).toBeGreaterThanOrEqual(4);
      const ids = signs.map((s) => s.id);
      expect(ids).toContain('neon-diner-open');
      expect(ids).toContain('neon-records');
      expect(ids).toContain('neon-tv');
    });

    it('creates complete ads system with wall murals and update loop', () => {
      const ads = create1965Ads();
      expect(ads.billboard).toBeDefined();
      expect(ads.neonSigns.length).toBeGreaterThanOrEqual(4);
      expect(ads.wallMurals.length).toBeGreaterThanOrEqual(2);
      ads.update(0.016, 1.5);
    });
  });

  describe('Vehicles Subsystem', () => {
    it('creates all 4 required 1965 vehicle types', () => {
      const sedan = createFinnedSedan(0x118ab2);
      const convertible = createConvertible(0xffd000);
      const beetle = createCompactBeetle(0x90e0ef);
      const van = createDeliveryVan(0xfdf0d5);

      expect(sedan.children.length).toBeGreaterThan(5);
      expect(convertible.children.length).toBeGreaterThan(5);
      expect(beetle.children.length).toBeGreaterThan(5);
      expect(van.children.length).toBeGreaterThan(5);
    });

    it('simulates traffic loop movement around block', () => {
      const vehicleSys = create1965Vehicles(layout);
      expect(vehicleSys.vehicles.length).toBeGreaterThanOrEqual(4);

      const initX = vehicleSys.vehicles[0].root.position.x;
      const initZ = vehicleSys.vehicles[0].root.position.z;

      vehicleSys.update(1.0);

      const newX = vehicleSys.vehicles[0].root.position.x;
      const newZ = vehicleSys.vehicles[0].root.position.z;
      expect(newX !== initX || newZ !== initZ).toBe(true);
    });
  });

  describe('Street Furniture Subsystem', () => {
    it('creates modernist double lamps, bus shelter, parking meters, phone booth, trash cans, hydrants', () => {
      const doubleLamp = createModernistDoubleLamp();
      const shelter = createBusShelter();
      const meter = createParkingMeter();
      const booth = createPhoneBooth();
      const trash = createTrashCan();

      expect(doubleLamp.children.length).toBeGreaterThan(4);
      expect(shelter.children.length).toBeGreaterThan(5);
      expect(meter.children.length).toBeGreaterThan(3);
      expect(booth.children.length).toBeGreaterThan(4);
      expect(trash.children.length).toBeGreaterThan(1);
    });

    it('populates street furniture along block sidewalks', () => {
      const furniture = create1965StreetFurniture(layout);
      expect(furniture.items.length).toBeGreaterThan(15);
      const kinds = furniture.items.map((it) => it.kind);
      expect(kinds).toContain('lamp_double');
      expect(kinds).toContain('bus_shelter');
      expect(kinds).toContain('phone_booth');
      expect(kinds).toContain('parking_meter');
      expect(kinds).toContain('trash_can');
    });
  });

  describe('Pedestrians Subsystem', () => {
    it('creates all 4 required pedestrian archetypes', () => {
      const suit = createSlimSuitPedestrian(0x1d3557);
      const dress = createShiftDressPedestrian(0xff5d73, 0x2ec4b6);
      const mod = createModPedestrian(0xf8f9fa);
      const teen = createTeenTransistorPedestrian();

      expect(suit.root.children.length).toBeGreaterThan(4);
      expect(dress.root.children.length).toBeGreaterThan(4);
      expect(mod.root.children.length).toBeGreaterThan(4);
      expect(teen.root.children.length).toBeGreaterThan(4);
    });

    it('populates and animates pedestrians along sidewalks', () => {
      const peds = create1965Pedestrians(layout);
      expect(peds.pedestrians.length).toBeGreaterThanOrEqual(6);
      peds.update(0.5, 2.0);
      const types = peds.pedestrians.map((p) => p.archetype);
      expect(types).toContain('slim_suit');
      expect(types).toContain('shift_dress');
      expect(types).toContain('mod_pattern');
      expect(types).toContain('teen_transistor');
    });
  });

  describe('Audio & SFX Stems Subsystem', () => {
    it('registers all 5 required 1965 SFX stems', () => {
      const mockSfxContext: SfxContext = {
        initialized: false,
        blip: () => {},
        dispose: () => {},
      };
      const audio = create1965Audio(mockSfxContext);

      expect(audio.stems).toHaveLength(5);
      const stemIds = audio.stems.map((s) => s.id);
      expect(stemIds).toContain('sfx-1965-surf-radio');
      expect(stemIds).toContain('sfx-1965-v8-burble');
      expect(stemIds).toContain('sfx-1965-bus-hiss');
      expect(stemIds).toContain('sfx-1965-neon-buzz');
      expect(stemIds).toContain('sfx-1965-jukebox-bleed');

      audio.start();
      expect(audio.isRunning).toBe(true);

      audio.setMasterVolume(0.5);
      audio.update(0.1, 1.0);

      audio.stop();
      expect(audio.isRunning).toBe(false);

      audio.dispose();
      mockSfxContext.dispose();
    });
  });
});
