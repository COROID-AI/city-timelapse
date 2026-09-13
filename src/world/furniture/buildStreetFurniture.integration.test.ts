import { describe, expect, it } from 'vitest';
import type { CameraView } from '../../core/cameraRig';
import { SceneEngine } from '../../core/engine';
import type { LightState } from '../../core/lighting';
import { applyAtmosphere, lightStateEquals } from '../../core/lighting';
import type { RendererFactoryOptions, SceneRenderer } from '../../core/renderer';
import { ERA_YEARS, type EraId } from '../../era/types';
import { createBlockLayout } from '../layout';
import { buildStreetFurniture, type EraStreetFurniture } from './buildStreetFurniture';

/** Headless renderer stub recording every atmosphere state it receives. */
class StubRenderer implements SceneRenderer<string> {
  readonly scene = 'integration-scene';
  lightStates: LightState[] = [];
  renderCount = 0;
  disposed = false;

  resize(): void {}
  applyLighting(state: LightState): void {
    this.lightStates.push(state);
  }
  updateCamera(_view: CameraView): void {}
  render(): void {
    this.renderCount += 1;
  }
  dispose(): void {
    this.disposed = true;
  }
}

describe('buildStreetFurniture(era) composition (src/world/furniture/buildStreetFurniture.ts)', () => {
  it('produces the full ground + furniture layer for all five eras', () => {
    for (const era of ERA_YEARS) {
      const furniture = buildStreetFurniture(era);
      expect(furniture.era).toBe(era);
      expect(furniture.layout).toBeDefined();
      expect(furniture.ground.asphalt.markings.length).toBeGreaterThanOrEqual(5);
      expect(furniture.ground.curbs).toHaveLength(4);
      expect(furniture.ground.sidewalks.bands).toHaveLength(4);
      expect(furniture.lamps.length).toBeGreaterThan(0);
      expect(furniture.trafficLights).toHaveLength(4);
      expect(furniture.hydrants.length).toBeGreaterThan(0);
      expect(furniture.benches.length).toBeGreaterThan(0);
      expect(furniture.booths.length).toBeGreaterThan(0);
      expect(furniture.bins.length).toBeGreaterThan(0);
      expect(furniture.mailboxes.length).toBeGreaterThan(0);
      expect(furniture.trees.length).toBeGreaterThan(0);
      expect(furniture.litter.items.length).toBeGreaterThan(0);
    }
  });

  it('populates every layout furniture anchor with exactly one result', () => {
    for (const era of ERA_YEARS) {
      const furniture = buildStreetFurniture(era);
      const layout = furniture.layout;
      const lamps = new Set(furniture.lamps.map((l) => l.anchorId));
      const lights = new Set(furniture.trafficLights.map((l) => l.anchorId));
      const hydrants = new Set(furniture.hydrants.map((h) => h.anchorId));
      const benches = new Set(furniture.benches.map((b) => b.anchorId));
      const booths = new Set(furniture.booths.map((b) => b.anchorId));
      const bins = new Set(furniture.bins.map((b) => b.anchorId));
      const mailboxes = new Set(furniture.mailboxes.map((m) => m.anchorId));
      const trees = new Set(furniture.trees.map((t) => t.anchorId));

      for (const anchor of layout.furnitureAnchors) {
        switch (anchor.kind) {
          case 'lamp_post':
            expect(lamps.has(anchor.id)).toBe(true);
            break;
          case 'traffic_light':
            expect(lights.has(anchor.id)).toBe(true);
            break;
          case 'fire_hydrant':
            expect(hydrants.has(anchor.id)).toBe(true);
            break;
          case 'bench':
            expect(benches.has(anchor.id)).toBe(true);
            break;
          case 'booth':
            expect(booths.has(anchor.id)).toBe(true);
            break;
          case 'trash_bin':
            expect(bins.has(anchor.id)).toBe(true);
            break;
          case 'mailbox':
            expect(mailboxes.has(anchor.id)).toBe(true);
            break;
          case 'tree':
            expect(trees.has(anchor.id)).toBe(true);
            break;
          default:
            throw new Error(`unhandled furniture anchor kind ${anchor.kind}`);
        }
      }
    }
  });

  it('keeps items on the BlockLayout anchors: identical seeds → identical output', () => {
    for (const era of ERA_YEARS) {
      const seed = era * 13 + 5;
      const a = buildStreetFurniture(era, { seed });
      const b = buildStreetFurniture(era, { seed });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
    // Eras differ even at the same seed.
    const a = buildStreetFurniture(1965, { seed: 99 });
    const b = buildStreetFurniture(1985, { seed: 99 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('throws for eras outside the five requested timeline stops', () => {
    expect(() => buildStreetFurniture(2055 as EraId)).toThrow(/unknown era/);
    expect(() => buildStreetFurniture(1900 as EraId)).toThrow(/unknown era/);
  });

  it('applies each era atmosphere preset only through the SceneEngine public hooks', () => {
    for (const era of ERA_YEARS) {
      const furniture = buildStreetFurniture(era);
      const renderer = new StubRenderer();
      const container = document.createElement('div');
      const engine = new SceneEngine<string>({
        container,
        factory: (options: RendererFactoryOptions) => {
          void options;
          return renderer;
        },
        atmosphere: furniture.atmosphere,
      });

      // Constructor hook: the preset reaches the renderer's lighting sink.
      expect(renderer.lightStates).toHaveLength(1);
      expect(lightStateEquals(renderer.lightStates[0]!, applyAtmosphere(furniture.atmosphere))).toBe(true);

      // Public setAtmosphere hook: same preset, pushed again, idempotent.
      engine.setAtmosphere(furniture.atmosphere);
      expect(renderer.lightStates).toHaveLength(2);
      expect(lightStateEquals(renderer.lightStates.at(-1)!, applyAtmosphere(furniture.atmosphere))).toBe(true);

      // Different era → visibly different mood.
      const other = buildStreetFurniture(era === 1945 ? 1985 : 1945);
      expect(lightStateEquals(renderer.lightStates.at(-1)!, applyAtmosphere(other.atmosphere))).toBe(false);

      engine.dispose();
      expect(renderer.disposed).toBe(true);
    }
  });

  it('close-up detail density holds up to pedestrian inspection in every era', () => {
    for (const era of ERA_YEARS) {
      const furniture = buildStreetFurniture(era);
      // Curb geometry: contiguous face runs with real dimensions.
      for (const curb of furniture.ground.curbs) {
        expect(curb.segments.length).toBeGreaterThan(10);
        for (const seg of curb.segments) {
          expect(seg.faceHeight).toBe(0.15);
          expect(seg.topWidth).toBe(0.25);
        }
      }
      // Painted markings: center line, stop lines, crosswalk bars present.
      const kinds = new Set(furniture.ground.asphalt.markings.map((m) => m.kind));
      expect(kinds.has('center_line')).toBe(true);
      expect(kinds.has('stop_line')).toBe(true);
      expect(kinds.has('crosswalk')).toBe(true);
      // Drains/manholes scattered along the road.
      expect(furniture.ground.asphalt.drains.length + furniture.ground.asphalt.manholes.length).toBeGreaterThan(20);
      // Bench slats: every bench has an individual seat surface.
      for (const bench of furniture.benches) {
        expect(bench.slats.length).toBeGreaterThanOrEqual(4);
      }
      // Booth glazing (phone-booth eras) with mullions and door.
      if (era === 1945 || era === 1965 || era === 1985) {
        for (const booth of furniture.booths) {
          expect(booth.glazing.length).toBeGreaterThanOrEqual(3);
          expect(booth.glazing.some((p) => p.hasDoor)).toBe(true);
          expect(booth.glazing.every((p) => p.mullions > 0)).toBe(true);
        }
      }
      // Leaf/branch variation and litter scatter at ground level.
      for (const tree of furniture.trees) {
        expect(tree.branches.length).toBeGreaterThanOrEqual(3);
        expect(tree.canopy.clumps.length).toBeGreaterThanOrEqual(3);
      }
      expect(furniture.litter.items.length).toBeGreaterThan(0);
    }
  });

  it('consumes the real BlockLayout contract end to end', () => {
    const layout = createBlockLayout(12345);
    const furniture: EraStreetFurniture = buildStreetFurniture(1945, { seed: 12345, layout });
    expect(furniture.layout).toBe(layout);
    expect(furniture.ground.asphalt.roadWidth).toBe(layout.dimensions.roadWidth);
    expect(furniture.ground.sidewalks.bands).toHaveLength(layout.sidewalkBands.length);
    expect(furniture.lamps).toHaveLength(layout.getAnchorsByKind('lamp_post').length);
    expect(furniture.trees).toHaveLength(layout.getAnchorsByKind('tree').length);
  });
});