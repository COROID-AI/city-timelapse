import { describe, expect, it } from 'vitest';
import {
  createBlockLayout,
  findLotAtPoint,
  isPointInAsphalt,
  isPointInSidewalk,
  rectsOverlap,
  sampleTrafficPath,
  type FurnitureAnchorKind,
} from './layout';

describe('BlockLayout (src/world/layout.ts)', () => {
  // ==========================================================================
  // 1. Module Contract & Determinism
  // ==========================================================================
  describe('Determinism and Purity', () => {
    it('creates structurally identical layouts for identical seeds', () => {
      const layout1 = createBlockLayout(42);
      const layout2 = createBlockLayout(42);

      // JSON stringify extracts pure data state without methods
      expect(JSON.stringify(layout1.dimensions)).toBe(JSON.stringify(layout2.dimensions));
      expect(JSON.stringify(layout1.lots)).toBe(JSON.stringify(layout2.lots));
      expect(JSON.stringify(layout1.lanes)).toBe(JSON.stringify(layout2.lanes));
      expect(JSON.stringify(layout1.furnitureAnchors)).toBe(JSON.stringify(layout2.furnitureAnchors));
      expect(JSON.stringify(layout1.asphaltAreas)).toBe(JSON.stringify(layout2.asphaltAreas));
      expect(JSON.stringify(layout1.sidewalkBands)).toBe(JSON.stringify(layout2.sidewalkBands));
      expect(JSON.stringify(layout1.intersection)).toBe(JSON.stringify(layout2.intersection));
      expect(JSON.stringify(layout1.pedestrianNetwork)).toBe(JSON.stringify(layout2.pedestrianNetwork));
    });

    it('works with default configuration when no argument is provided', () => {
      const layout = createBlockLayout();
      expect(layout.seed).toBe(42);
      expect(layout.lots.length).toBeGreaterThanOrEqual(12);
    });

    it('contains no DOM or Three.js dependencies (plain numbers/objects)', () => {
      const layout = createBlockLayout(100);
      for (const lot of layout.lots) {
        expect(typeof lot.center.x).toBe('number');
        expect(typeof lot.center.y).toBe('number');
        expect(typeof lot.center.z).toBe('number');
      }
      for (const anchor of layout.furnitureAnchors) {
        expect(typeof anchor.position.x).toBe('number');
        expect(typeof anchor.facing).toBe('number');
      }
    });
  });

  // ==========================================================================
  // 2. Street Grid & Intersection
  // ==========================================================================
  describe('Street Grid and Intersection', () => {
    const layout = createBlockLayout(42);

    it('exposes a central cross intersection with 2 named through-streets', () => {
      expect(layout.streets).toHaveLength(2);
      const streetNames = layout.streets.map((s) => s.name);
      expect(streetNames).toContain('Market Street');
      expect(streetNames).toContain('Main Avenue');

      const market = layout.streets.find((s) => s.name === 'Market Street')!;
      const main = layout.streets.find((s) => s.name === 'Main Avenue')!;

      expect(market.axis).toBe('x');
      expect(market.direction).toBe('east_west');
      expect(market.laneCount).toBe(2);
      expect(market.roadWidth).toBe(14);

      expect(main.axis).toBe('z');
      expect(main.direction).toBe('north_south');
      expect(main.laneCount).toBe(2);
      expect(main.roadWidth).toBe(14);
    });

    it('defines asphalt areas covering the entire cross grid without gaps', () => {
      expect(layout.asphaltAreas.length).toBeGreaterThanOrEqual(2);
      const bounds = layout.dimensions.bounds;

      // Check center of intersection is asphalt
      expect(isPointInAsphalt(layout, { x: 0, z: 0 })).toBe(true);

      // Check east-west road extremes are asphalt
      expect(isPointInAsphalt(layout, { x: bounds.minX + 1, z: 0 })).toBe(true);
      expect(isPointInAsphalt(layout, { x: bounds.maxX - 1, z: 0 })).toBe(true);

      // Check north-south road extremes are asphalt
      expect(isPointInAsphalt(layout, { x: 0, z: bounds.minZ + 1 })).toBe(true);
      expect(isPointInAsphalt(layout, { x: 0, z: bounds.maxZ - 1 })).toBe(true);
    });

    it('defines intersection center and 4 corner plazas', () => {
      expect(layout.intersection.center).toEqual({ x: 0, y: 0, z: 0 });
      expect(layout.intersection.cornerPlazas).toHaveLength(4);

      const quads = layout.intersection.cornerPlazas.map((p) => p.quadrant);
      expect(quads).toContain('NE');
      expect(quads).toContain('NW');
      expect(quads).toContain('SE');
      expect(quads).toContain('SW');
    });

    it('defines 4 crosswalks crossing each street arm at intersection', () => {
      expect(layout.intersection.crosswalks).toHaveLength(4);
      for (const cw of layout.intersection.crosswalks) {
        expect(cw.width).toBeGreaterThanOrEqual(2.5);
        expect(cw.waypoints.length).toBeGreaterThanOrEqual(2);
        // Crosswalk waypoints transition from sidewalk elevation to asphalt level to sidewalk elevation
        expect(cw.startPoint.y).toBe(layout.dimensions.curbHeight);
        expect(cw.endPoint.y).toBe(layout.dimensions.curbHeight);
      }
    });
  });

  // ==========================================================================
  // 3. Building Lots
  // ==========================================================================
  describe('Building Lots', () => {
    const layout = createBlockLayout(42);

    it('provides at least 12 building lots with footprints and heights', () => {
      expect(layout.lots.length).toBeGreaterThanOrEqual(12);
      expect(layout.lots.length).toBe(16); // 4 per quadrant
    });

    it('distributes lots across all 4 quadrants', () => {
      const neLots = layout.getLotsByQuadrant('NE');
      const nwLots = layout.getLotsByQuadrant('NW');
      const seLots = layout.getLotsByQuadrant('SE');
      const swLots = layout.getLotsByQuadrant('SW');

      expect(neLots.length).toBeGreaterThanOrEqual(3);
      expect(nwLots.length).toBeGreaterThanOrEqual(3);
      expect(seLots.length).toBeGreaterThanOrEqual(3);
      expect(swLots.length).toBeGreaterThanOrEqual(3);
    });

    it('ensures all lot footprints stay inside the block bounds', () => {
      const bounds = layout.dimensions.bounds;
      for (const lot of layout.lots) {
        expect(lot.bounds.minX).toBeGreaterThanOrEqual(bounds.minX);
        expect(lot.bounds.maxX).toBeLessThanOrEqual(bounds.maxX);
        expect(lot.bounds.minZ).toBeGreaterThanOrEqual(bounds.minZ);
        expect(lot.bounds.maxZ).toBeLessThanOrEqual(bounds.maxZ);
      }
    });

    it('ensures lots maintain clearance from the sidewalk band (setback)', () => {
      const minDistanceToCenter = layout.dimensions.roadWidth / 2 + layout.dimensions.sidewalkWidth + layout.dimensions.lotSetback;

      for (const lot of layout.lots) {
        // Any lot in NE quadrant must have minX >= minDistanceToCenter and minZ >= minDistanceToCenter
        if (lot.quadrant === 'NE') {
          expect(lot.bounds.minX).toBeGreaterThanOrEqual(minDistanceToCenter);
          expect(lot.bounds.minZ).toBeGreaterThanOrEqual(minDistanceToCenter);
        } else if (lot.quadrant === 'NW') {
          expect(lot.bounds.maxX).toBeLessThanOrEqual(-minDistanceToCenter);
          expect(lot.bounds.minZ).toBeGreaterThanOrEqual(minDistanceToCenter);
        } else if (lot.quadrant === 'SE') {
          expect(lot.bounds.minX).toBeGreaterThanOrEqual(minDistanceToCenter);
          expect(lot.bounds.maxZ).toBeLessThanOrEqual(-minDistanceToCenter);
        } else if (lot.quadrant === 'SW') {
          expect(lot.bounds.maxX).toBeLessThanOrEqual(-minDistanceToCenter);
          expect(lot.bounds.maxZ).toBeLessThanOrEqual(-minDistanceToCenter);
        }
      }
    });

    it('ensures no building lots overlap each other', () => {
      for (let i = 0; i < layout.lots.length; i += 1) {
        for (let j = i + 1; j < layout.lots.length; j += 1) {
          const lotA = layout.lots[i]!;
          const lotB = layout.lots[j]!;
          const overlaps = rectsOverlap(lotA.bounds, lotB.bounds);
          expect(overlaps).toBe(false);
        }
      }
    });

    it('specifies valid height limits and zoning for each lot', () => {
      for (const lot of layout.lots) {
        expect(lot.heightLimits.min).toBeGreaterThan(0);
        expect(lot.heightLimits.max).toBeGreaterThan(lot.heightLimits.min);
        expect(lot.heightLimits.recommended).toBeGreaterThanOrEqual(lot.heightLimits.min);
        expect(lot.heightLimits.recommended).toBeLessThanOrEqual(lot.heightLimits.max);
        expect(['commercial', 'mixed_use', 'residential', 'civic']).toContain(lot.zoning);
      }
    });

    it('provides storefront zones and frontage vectors on every lot', () => {
      for (const lot of layout.lots) {
        expect(lot.frontage).toBeDefined();
        expect(lot.frontage.streetName).toBeTruthy();
        expect(Math.hypot(lot.frontage.normal.x, lot.frontage.normal.z)).toBeCloseTo(1.0);
        expect(lot.storefrontZone.facadeWidth).toBeGreaterThan(0);
        expect(lot.storefrontZone.signageAnchor.y).toBeGreaterThan(lot.storefrontZone.entryPoint.y);
      }
    });

    it('findLotAtPoint correctly resolves lot containment', () => {
      const lot0 = layout.lots[0]!;
      const insidePoint = { x: lot0.center.x, z: lot0.center.z };
      expect(findLotAtPoint(layout, insidePoint)?.id).toBe(lot0.id);

      // Origin (intersection) should have no lot
      expect(findLotAtPoint(layout, { x: 0, z: 0 })).toBeUndefined();
    });
  });

  // ==========================================================================
  // 4. Sidewalks, Curbs & Pedestrian Network
  // ==========================================================================
  describe('Sidewalks, Curbs and Pedestrian Network', () => {
    const layout = createBlockLayout(42);

    it('defines continuous sidewalk and curb bands flanking every street edge', () => {
      expect(layout.sidewalkBands).toHaveLength(4);

      for (const sb of layout.sidewalkBands) {
        expect(sb.width).toBe(layout.dimensions.sidewalkWidth);
        expect(sb.elevation).toBe(layout.dimensions.curbHeight);
        expect(sb.curbBand).toBeDefined();
        expect(sb.curbBand.width).toBe(layout.dimensions.curbWidth);
        expect(sb.curbBand.height).toBe(layout.dimensions.curbHeight);
      }
    });

    it('exposes a connected pedestrian network with nodes and segments', () => {
      const net = layout.pedestrianNetwork;
      expect(net.nodes.length).toBeGreaterThanOrEqual(10);
      expect(net.segments.length).toBeGreaterThanOrEqual(10);

      // Verify all segment node references exist in nodes map
      const nodeIds = new Set(net.nodes.map((n) => n.id));
      for (const seg of net.segments) {
        expect(nodeIds.has(seg.fromNodeId)).toBe(true);
        expect(nodeIds.has(seg.toNodeId)).toBe(true);
        expect(seg.waypoints.length).toBeGreaterThanOrEqual(2);
        expect(seg.length).toBeGreaterThan(0);
      }
    });

    it('walkway sidewalk nodes and longitudinal segments never enter vehicle lanes or lots', () => {
      const net = layout.pedestrianNetwork;
      const sidewalkSegments = net.segments.filter((s) => s.kind === 'sidewalk');

      for (const seg of sidewalkSegments) {
        for (const wp of seg.waypoints) {
          // Sidewalk waypoints must not be inside any vehicle lane or lot
          expect(findLotAtPoint(layout, wp)).toBeUndefined();
          // Must not be in asphalt
          expect(isPointInAsphalt(layout, wp)).toBe(false);
          // Must be in sidewalk
          expect(isPointInSidewalk(layout, wp)).toBe(true);
        }
      }
    });
  });

  // ==========================================================================
  // 5. Vehicle Lanes & Traffic Paths
  // ==========================================================================
  describe('Vehicle Lanes and Traffic Flow Paths', () => {
    const layout = createBlockLayout(42);

    it('exposes vehicle lanes per direction (eastbound, westbound, northbound, southbound)', () => {
      expect(layout.lanes).toHaveLength(4);

      const eb = layout.getLanesByDirection('eastbound');
      const wb = layout.getLanesByDirection('westbound');
      const nb = layout.getLanesByDirection('northbound');
      const sb = layout.getLanesByDirection('southbound');

      expect(eb).toHaveLength(1);
      expect(wb).toHaveLength(1);
      expect(nb).toHaveLength(1);
      expect(sb).toHaveLength(1);
    });

    it('opposing vehicle lanes have separated center offsets and non-overlapping bounds', () => {
      const eb = layout.getLanesByDirection('eastbound')[0]!;
      const wb = layout.getLanesByDirection('westbound')[0]!;
      expect(eb.centerOffset).not.toBe(wb.centerOffset);
      expect(rectsOverlap(eb.bounds, wb.bounds)).toBe(false);

      const nb = layout.getLanesByDirection('northbound')[0]!;
      const sb = layout.getLanesByDirection('southbound')[0]!;
      expect(nb.centerOffset).not.toBe(sb.centerOffset);
      expect(rectsOverlap(nb.bounds, sb.bounds)).toBe(false);
    });

    it('each lane has monotonic straight flow waypoints in its travel direction', () => {
      // Eastbound: X coordinates strictly increase
      const eb = layout.getLanesByDirection('eastbound')[0]!;
      const ebWps = eb.flowPath.waypoints;
      for (let i = 1; i < ebWps.length; i += 1) {
        expect(ebWps[i]!.x).toBeGreaterThan(ebWps[i - 1]!.x);
      }

      // Westbound: X coordinates strictly decrease
      const wb = layout.getLanesByDirection('westbound')[0]!;
      const wbWps = wb.flowPath.waypoints;
      for (let i = 1; i < wbWps.length; i += 1) {
        expect(wbWps[i]!.x).toBeLessThan(wbWps[i - 1]!.x);
      }

      // Northbound: Z coordinates strictly increase
      const nb = layout.getLanesByDirection('northbound')[0]!;
      const nbWps = nb.flowPath.waypoints;
      for (let i = 1; i < nbWps.length; i += 1) {
        expect(nbWps[i]!.z).toBeGreaterThan(nbWps[i - 1]!.z);
      }

      // Southbound: Z coordinates strictly decrease
      const sb = layout.getLanesByDirection('southbound')[0]!;
      const sbWps = sb.flowPath.waypoints;
      for (let i = 1; i < sbWps.length; i += 1) {
        expect(sbWps[i]!.z).toBeLessThan(sbWps[i - 1]!.z);
      }
    });

    it('all lane straight and turning path waypoints stay within the asphalt road area and never enter lots', () => {
      for (const lane of layout.lanes) {
        const allPaths = [lane.flowPath, ...lane.turnPaths];
        expect(allPaths.length).toBeGreaterThanOrEqual(3); // straight + right + left

        for (const path of allPaths) {
          expect(path.length).toBeGreaterThan(0);
          for (const wp of path.waypoints) {
            // Must stay inside asphalt area
            expect(isPointInAsphalt(layout, wp)).toBe(true);
            // Must never enter building lots
            expect(findLotAtPoint(layout, wp)).toBeUndefined();
          }
        }
      }
    });

    it('sampleTrafficPath correctly interpolates positions along a path', () => {
      const eb = layout.getLanesByDirection('eastbound')[0]!;
      const start = sampleTrafficPath(eb.flowPath, 0);
      const mid = sampleTrafficPath(eb.flowPath, 0.5);
      const end = sampleTrafficPath(eb.flowPath, 1);

      expect(start.x).toBeCloseTo(-layout.dimensions.totalWidth / 2);
      expect(mid.x).toBeCloseTo(0, 0);
      expect(end.x).toBeCloseTo(layout.dimensions.totalWidth / 2);
    });
  });

  // ==========================================================================
  // 6. Furniture Anchors
  // ==========================================================================
  describe('Furniture Anchor Points', () => {
    const layout = createBlockLayout(42);

    const requiredKinds: FurnitureAnchorKind[] = [
      'lamp_post',
      'traffic_light',
      'fire_hydrant',
      'bench',
      'tree',
      'trash_bin',
      'booth',
    ];

    it('publishes anchors for all required kinds', () => {
      for (const kind of requiredKinds) {
        const anchors = layout.getAnchorsByKind(kind);
        expect(anchors.length).toBeGreaterThan(0);
      }
    });

    it('all furniture anchors sit on sidewalk/corner ground and never in vehicle lanes or lots', () => {
      expect(layout.furnitureAnchors.length).toBeGreaterThanOrEqual(40);

      for (const anchor of layout.furnitureAnchors) {
        // Never inside a building lot
        const lot = findLotAtPoint(layout, anchor.position);
        expect(lot).toBeUndefined();

        // Never inside road asphalt
        const inRoad = isPointInAsphalt(layout, anchor.position);
        expect(inRoad).toBe(false);

        // Must sit inside sidewalk bounds
        const inSidewalk = isPointInSidewalk(layout, anchor.position);
        expect(inSidewalk).toBe(true);

        // Elevation matches curb height
        expect(anchor.position.y).toBeCloseTo(layout.dimensions.curbHeight);

        // Facing direction is a normalized vector
        const len = Math.hypot(anchor.facingVector.x, anchor.facingVector.z);
        expect(len).toBeCloseTo(1.0);
      }
    });

    it('findClosestAnchor finds the nearest anchor point', () => {
      const testPoint = { x: 8.0, y: 0, z: 8.0 };
      const nearest = layout.findClosestAnchor(testPoint);
      expect(nearest).toBeDefined();

      const nearestLamp = layout.findClosestAnchor(testPoint, 'lamp_post');
      expect(nearestLamp).toBeDefined();
      expect(nearestLamp?.kind).toBe('lamp_post');
    });

    it('traffic lights sit specifically at the 4 intersection corners', () => {
      const lights = layout.getAnchorsByKind('traffic_light');
      expect(lights).toHaveLength(4);

      const quads = lights.map((l) => l.quadrant);
      expect(quads).toContain('NE');
      expect(quads).toContain('NW');
      expect(quads).toContain('SE');
      expect(quads).toContain('SW');
    });
  });
});
