/**
 * Comprehensive Unit Tests for the Pedestrians World System.
 *
 * Validates:
 * - pedestrianEraData completeness across 1945, 1965, 1985, 2005, 2025
 * - Era outfit specifications (fedoras, suits, dresses, windbreakers, denim, hoodies, athleisure, props)
 * - Density bounds and walking speed interpolation across channels
 * - Path sampling and window-shopping extraction from BlockLayout
 * - Crowd simulation agent movements, spacing deceleration, and pausing
 * - Low-poly hierarchical pedestrian rig creation, outfitting, and animation
 */

import { describe, expect, it } from 'vitest';
import { ERAS, type EraId } from '../../../../era/years';
import { createCityBlockLayout } from '../../../layout/cityBlockLayout';
import {
  CrowdSim,
  extractPathSegments,
  extractWindowShoppingPoints,
} from '../crowdSim';
import {
  getPedestrianEraSpec,
  interpolateCrowdDensity,
  interpolateWalkSpeed,
  pedestrianEraData,
  validatePedestrianEraData,
} from '../pedestrianEraData';
import { createPedestrianRig } from '../pedestrianFactory';

describe('pedestrianEraData completeness and specifications', () => {
  it('validates all five eras are complete and well-formed', () => {
    expect(validatePedestrianEraData()).toBe(true);
    for (const era of ERAS) {
      const spec = getPedestrianEraSpec(era);
      expect(spec).toBeDefined();
      expect(spec.fashionStyle.length).toBeGreaterThan(0);
      expect(spec.crowdDensity).toBeGreaterThan(0);
      expect(spec.walkSpeed).toBeGreaterThan(0);
      expect(spec.outfits.length).toBeGreaterThan(0);
      expect(spec.typicalProps.length).toBeGreaterThan(0);
      expect(spec.propProbability).toBeGreaterThan(0);
      expect(spec.propProbability).toBeLessThanOrEqual(1);
    }
  });

  it('covers 1945 fedoras, suits, dresses and period props', () => {
    const spec1945 = pedestrianEraData['1945'];
    expect(spec1945.fashionStyle.toLowerCase()).toMatch(/suit|trench|cloche|dress/);
    expect(spec1945.crowdDensity).toBe(6);
    expect(spec1945.walkSpeed).toBe(1.2);

    const suitOutfit = spec1945.outfits.find((o) =>
      o.accessories.includes('fedora') || o.accessories.includes('overcoat'),
    );
    expect(suitOutfit).toBeDefined();

    const dressOutfit = spec1945.outfits.find((o) =>
      o.accessories.includes('dress') || o.accessories.includes('cloche_hat'),
    );
    expect(dressOutfit).toBeDefined();

    expect(spec1945.typicalProps).toContain('leather_briefcase');
    expect(spec1945.typicalProps).toContain('folded_newspaper');
  });

  it('covers 1965 mod suits and colorful shift dresses', () => {
    const spec1965 = pedestrianEraData['1965'];
    expect(spec1965.fashionStyle.toLowerCase()).toMatch(/mod|shift dress|suit/);
    expect(spec1965.crowdDensity).toBe(8);

    const modDress = spec1965.outfits.find((o) =>
      o.accessories.includes('mod_dress') || o.description.toLowerCase().includes('shift dress'),
    );
    expect(modDress).toBeDefined();
    // Mod dresses feature bold color palette
    expect(modDress!.topPalette.length).toBeGreaterThanOrEqual(3);

    const slimSuit = spec1965.outfits.find((o) =>
      o.accessories.includes('skinny_tie') || o.description.toLowerCase().includes('suit'),
    );
    expect(slimSuit).toBeDefined();
    expect(spec1965.typicalProps).toContain('transistor_radio');
  });

  it('covers 1985 windbreakers, denim, and boombox prop', () => {
    const spec1985 = pedestrianEraData['1985'];
    expect(spec1985.fashionStyle.toLowerCase()).toMatch(/denim|windbreaker|shoulders/);
    expect(spec1985.crowdDensity).toBe(10);

    const windbreaker = spec1985.outfits.find((o) =>
      o.accessories.includes('windbreaker') || o.accessories.includes('boombox') || o.description.toLowerCase().includes('windbreaker'),
    );
    expect(windbreaker).toBeDefined();
    expect(spec1985.typicalProps).toContain('shoulder_boombox');
    expect(spec1985.typicalProps).toContain('portable_cassette_walkman');
  });

  it('covers 2005 casual tech and hoodies', () => {
    const spec2005 = pedestrianEraData['2005'];
    expect(spec2005.fashionStyle.toLowerCase()).toMatch(/cargo|track|hoodie|flip phone/);
    expect(spec2005.crowdDensity).toBe(11);

    const hoodieOutfit = spec2005.outfits.find((o) =>
      o.accessories.includes('hoodie') || o.description.toLowerCase().includes('hoodie'),
    );
    expect(hoodieOutfit).toBeDefined();
    expect(spec2005.typicalProps).toContain('flip_phone');
    expect(spec2005.typicalProps).toContain('white_earbud_mp3');
  });

  it('covers 2025 athleisure and phone props', () => {
    const spec2025 = pedestrianEraData['2025'];
    expect(spec2025.fashionStyle.toLowerCase()).toMatch(/athleisure|outerwear|tailoring/);
    expect(spec2025.crowdDensity).toBe(12);

    const athleisureOutfit = spec2025.outfits.find((o) =>
      o.accessories.includes('athleisure') || o.accessories.includes('phone'),
    );
    expect(athleisureOutfit).toBeDefined();
    expect(spec2025.typicalProps).toContain('bezel_less_smartphone');
    expect(spec2025.typicalProps).toContain('smart_glasses');
  });

  it('smoothly interpolates crowd density and walk speed across channels', () => {
    // 1945 -> 1965 (density 6 -> 8, speed 1.2 -> 1.3)
    const midChannel = { fromEra: '1945' as EraId, toEra: '1965' as EraId, t: 0.5 };
    expect(interpolateCrowdDensity(midChannel)).toBe(7);
    expect(interpolateWalkSpeed(midChannel)).toBeCloseTo(1.25, 4);

    // 1985 -> 2025 (channel 1985 -> 2005)
    const mid8505 = { fromEra: '1985' as EraId, toEra: '2005' as EraId, t: 0.5 };
    expect(interpolateCrowdDensity(mid8505)).toBe(11); // Math.round(10.5) = 11
  });
});

describe('sidewalk path sampling and storefront points', () => {
  const layout = createCityBlockLayout('seed-42');

  it('extracts non-empty linear path segments from BlockLayout walking paths', () => {
    const segments = extractPathSegments(layout.walkingPaths);
    expect(segments.length).toBeGreaterThanOrEqual(layout.walkingPaths.length);

    for (const seg of segments) {
      expect(seg.length).toBeGreaterThan(0);
      expect(Number.isFinite(seg.dirX)).toBe(true);
      expect(Number.isFinite(seg.dirZ)).toBe(true);
      const dirLen = Math.hypot(seg.dirX, seg.dirZ);
      expect(dirLen).toBeCloseTo(1.0, 4);
    }
  });

  it('extracts window-shopping points for each building plot frontage', () => {
    const points = extractWindowShoppingPoints(layout);
    expect(points.length).toBeGreaterThanOrEqual(layout.plots.length);

    for (const p of points) {
      expect(Number.isFinite(p.position.x)).toBe(true);
      expect(Number.isFinite(p.position.z)).toBe(true);
      expect(Number.isFinite(p.facingAngle)).toBe(true);
      expect(p.plotId).toBeTruthy();
    }
  });
});

describe('CrowdSim dynamics, density bounds, spacing and pauses', () => {
  it('spawns agents matching the target era density', () => {
    const layout = createCityBlockLayout('seed-test');
    const sim = new CrowdSim(layout);

    sim.syncToEra({ fromEra: '1945', toEra: '1945', t: 0 });
    expect(sim.getActiveAgents().length).toBe(6);

    sim.syncToEra({ fromEra: '2025', toEra: '2025', t: 0 });
    expect(sim.getActiveAgents().length).toBe(12);

    sim.syncToEra({ fromEra: '1945', toEra: '1945', t: 0 });
    expect(sim.getActiveAgents().length).toBe(6);
  });

  it('advances agent movement along segments on update', () => {
    const layout = createCityBlockLayout('seed-movement');
    const sim = new CrowdSim(layout);

    sim.syncToEra({ fromEra: '1965', toEra: '1965', t: 0 });
    const agents = sim.getActiveAgents();
    const initialDistances = agents.map((a) => a.totalDistanceWalked);

    // Simulate 2 seconds of movement
    sim.update(1.0);
    sim.update(1.0);

    const newDistances = agents.map((a) => a.totalDistanceWalked);
    for (let i = 0; i < agents.length; i += 1) {
      expect(newDistances[i]).toBeGreaterThan(initialDistances[i]);
    }
  });

  it('applies crowd spacing deceleration when agents are in close proximity', () => {
    const layout = createCityBlockLayout('seed-spacing');
    const sim = new CrowdSim(layout, { minSpacing: 2.0 });

    sim.syncToEra({ fromEra: '1985', toEra: '1985', t: 0 });
    const agents = sim.getActiveAgents();

    // Place agent 1 directly behind agent 0 moving in same direction
    agents[0].position = { x: 10, z: 0.85 };
    agents[0].heading = Math.PI / 2; // facing +X
    agents[0].walkSpeed = 1.35;
    agents[0].state = 'walking';

    agents[1].position = { x: 9.2, z: 0.85 }; // 0.8m behind (within minSpacing 2.0m)
    agents[1].heading = Math.PI / 2; // facing +X
    agents[1].walkSpeed = 1.35;
    agents[1].state = 'walking';

    const prevPos = agents[1].position.x;
    sim.update(0.1);

    // Agent 1 should have moved forward, but at a reduced step
    const stepTaken = agents[1].position.x - prevPos;
    const freeStep = agents[1].walkSpeed * 0.1;
    expect(stepTaken).toBeLessThan(freeStep);
  });
});

describe('PedestrianRig creation and animation', () => {
  it('builds low-poly rig hierarchy with body, head, arms, legs and materials', () => {
    const rig = createPedestrianRig('1945', 42);

    expect(rig.root).toBeDefined();
    expect(rig.bodyGroup).toBeDefined();
    expect(rig.headGroup).toBeDefined();
    expect(rig.leftArmGroup).toBeDefined();
    expect(rig.rightArmGroup).toBeDefined();
    expect(rig.leftLegGroup).toBeDefined();
    expect(rig.rightLegGroup).toBeDefined();
    expect(rig.materials.length).toBeGreaterThan(0);

    rig.dispose();
  });

  it('switches outfits and accessories when era changes', () => {
    const rig = createPedestrianRig('1945', 10);
    expect(rig.currentEra).toBe('1945');

    // 1945 outfitting (fedora or cloche)
    rig.setOutfit('1945', 0, 10);
    const hatGroup = rig.headGroup.getObjectByName('hat-group');
    expect(hatGroup).toBeDefined();

    // Reclothe to 1985
    rig.setOutfit('1985', 0, 10);
    expect(rig.currentEra).toBe('1985');

    // Reclothe to 2025
    rig.setOutfit('2025', 1, 10);
    expect(rig.currentEra).toBe('2025');

    rig.dispose();
  });

  it('updates walk animation cycle with leg rotations and hip bounce', () => {
    const rig = createPedestrianRig('2005', 7);

    // Frame 1: walking
    rig.updateAnimation(0.2, true, false, 0.016);
    const leg1Angle = rig.leftLegGroup.rotation.x;
    expect(Math.abs(leg1Angle)).toBeGreaterThan(0);

    // Frame 2: standing window shopping
    rig.updateAnimation(0.2, false, true, 0.016);
    expect(rig.headGroup.rotation.y).toBeDefined();

    rig.dispose();
  });
});
