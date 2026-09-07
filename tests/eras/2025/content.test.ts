import { describe, expect, it } from 'vitest';
import { era2025Content } from '../../../src/eras/2025';
import { palette } from '../../../src/eras/2025/palette';
import { audioStems } from '../../../src/eras/2025/audio';
import { CANONICAL_ERAS } from '../../../src/types/city';

describe('Era 2025 content', () => {
  it('is registered for the canonical 2025 year', () => {
    expect(era2025Content.year).toBe(2025);
    expect(CANONICAL_ERAS).toContain(era2025Content.year);
    expect(era2025Content.label).toBe('2025');
  });

  it('covers every required content domain', () => {
    expect(era2025Content.buildings.length).toBeGreaterThanOrEqual(10);
    expect(era2025Content.storefronts.length).toBeGreaterThanOrEqual(7);
    expect(era2025Content.advertisements.length).toBeGreaterThanOrEqual(5);
    expect(era2025Content.vehicles.length).toBeGreaterThanOrEqual(6);
    expect(era2025Content.streetFurniture.length).toBeGreaterThanOrEqual(5);
    expect(era2025Content.pedestrians.length).toBeGreaterThanOrEqual(8);
    expect(era2025Content.textures.length).toBeGreaterThanOrEqual(5);
  });

  it('builds the signature glass tower with LED accents, green roof, solar panels and EV canopy', () => {
    const tower = era2025Content.buildings.find((b) => b.kind === 'glass-tower');
    expect(tower).toBeDefined();
    expect(tower!.ledAccent).toBe(true);
    expect(tower!.greenRoof).toBe(true);
    expect(tower!.solarPanels).toBe(true);
    expect(tower!.evCanopy).toBe(true);
    expect(tower!.smallCells5g).toBe(true);
    expect(tower!.height).toBeGreaterThan(40);
  });

  it('includes restored brick walk-ups and 5G small cells', () => {
    const walkups = era2025Content.buildings.filter((b) => b.kind === 'brick-walkup');
    expect(walkups.length).toBeGreaterThan(0);
    for (const w of walkups) {
      expect(w.smallCells5g).toBe(true);
    }
  });

  it('includes the required storefront archetypes', () => {
    const kinds = era2025Content.storefronts.map((s) => s.kind);
    expect(kinds).toContain('coffee-roastery');
    expect(kinds).toContain('vegan-cafe');
    expect(kinds).toContain('food-hall');
    expect(kinds).toContain('co-working');
    expect(kinds).toContain('ev-showroom');
    expect(kinds).toContain('mini-mart');
    expect(kinds).toContain('dark-store');
  });

  it('includes full-motion LED billboards, QR posters and ad totems', () => {
    const ads = era2025Content.advertisements;
    expect(ads.some((a) => a.kind === 'led-billboard' && a.motion)).toBe(true);
    expect(ads.some((a) => a.kind === 'qr-poster' && a.qr)).toBe(true);
    expect(ads.some((a) => a.kind === 'ad-totem' && a.motion)).toBe(true);
    expect(ads.some((a) => a.kind === 'delivery-decal')).toBe(true);
    expect(ads.some((a) => a.kind === 'window-screen')).toBe(true);
  });

  it('uses an EV-dominant, ride-share and delivery traffic mix', () => {
    const v = era2025Content.vehicles;
    expect(v.every((x) => x.electric)).toBe(true);
    expect(v.some((x) => x.kind === 'ev-sedan')).toBe(true);
    expect(v.some((x) => x.kind === 'ev-crossover')).toBe(true);
    expect(v.some((x) => x.kind === 'e-scooter')).toBe(true);
    expect(v.some((x) => x.kind === 'e-cargo-bike')).toBe(true);
    expect(v.some((x) => x.kind === 'ride-share' && x.rideShareSticker)).toBe(true);
    expect(v.some((x) => x.kind === 'delivery-van')).toBe(true);
  });

  it('includes smart street furniture: LED lights, bike posts, floating bus stop, rain gardens, delivery robots', () => {
    const f = era2025Content.streetFurniture;
    expect(f.some((x) => x.kind === 'led-street-light' && x.smartSensors)).toBe(true);
    expect(f.some((x) => x.kind === 'bike-lane-post')).toBe(true);
    expect(f.some((x) => x.kind === 'floating-bus-stop' && x.liveScreen)).toBe(true);
    expect(f.some((x) => x.kind === 'rain-garden')).toBe(true);
    expect(f.some((x) => x.kind === 'delivery-robot' && x.smartSensors)).toBe(true);
  });

  it('has a high-density pedestrian mix with athleisure, QR scanners, couriers, dog walkers and remote workers', () => {
    const p = era2025Content.pedestrians;
    expect(p.some((x) => x.kind === 'athleisure')).toBe(true);
    expect(p.some((x) => x.kind === 'tech-casual')).toBe(true);
    expect(p.some((x) => x.kind === 'qr-scanner' && x.scanningQr)).toBe(true);
    expect(p.some((x) => x.kind === 'food-courier' && x.backpack)).toBe(true);
    expect(p.some((x) => x.kind === 'dog-walker')).toBe(true);
    expect(p.some((x) => x.kind === 'remote-worker')).toBe(true);
    expect(p.every((x) => x.earbuds || x.kind === 'food-courier')).toBe(true);
  });

  it('applies a crisp high-contrast modern grade', () => {
    expect(palette.name).toContain('2025');
    expect(palette.grade.contrast).toBeGreaterThan(1);
    expect(palette.grade.saturation).toBeGreaterThan(1);
    expect(palette.grade.temperature).toBe('cool-white');
    expect(palette.ledAccent).toBeTruthy();
    expect(palette.glassFacade).toBeTruthy();
  });

  it('registers era-specific ambience/SFX stems', () => {
    const ids = audioStems.stems.map((s) => s.id);
    expect(ids).toContain('ev-whir');
    expect(ids).toContain('escooter-hum');
    expect(ids).toContain('notification-ping');
    expect(ids).toContain('courier-chatter');
    expect(ids).toContain('cafe-chatter');
    expect(ids).toContain('tower-construction');
    expect(audioStems.loopId).toBe('modern-ambient-loop');
    expect(ids).toContain(audioStems.loopId);
  });

  it('maps street furniture onto the shared StreetFeature contract', () => {
    const features = era2025Content.streetFeatures();
    expect(features.length).toBeGreaterThanOrEqual(3);
    for (const f of features) {
      expect(f.eras).toContain(2025);
      expect(f.rect.width).toBeGreaterThan(0);
      expect(f.rect.depth).toBeGreaterThan(0);
    }
  });
});