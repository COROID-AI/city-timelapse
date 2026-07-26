/**
 * Tests for the consumable RoadNetwork — verifies typed nodes/edges for driving,
 * parking, cycling, and walking lanes with directions, crosswalks, the
 * signalized intersection, and building-lot footprints aligned to the sidewalk.
 */
import { describe, expect, it } from 'vitest';
import { buildRoadNetwork } from '../BlockLayout.js';
import { edgesOfType, getNode, type LaneType } from '../roadNetwork.js';

const NETWORK = buildRoadNetwork();

describe('RoadNetwork — lane coverage', () => {
  const requiredTypes: LaneType[] = ['driving', 'parking', 'cycling', 'walking', 'crosswalk'];

  it.each(requiredTypes)('contains typed edges for the %s lane', (type) => {
    const edges = edgesOfType(NETWORK, type);
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((e) => e.laneType === type)).toBe(true);
  });

  it('every node references a known lane type', () => {
    for (const node of NETWORK.nodes) {
      expect(requiredTypes).toContain(node.laneType);
    }
  });

  it('every edge connects two existing nodes', () => {
    for (const edge of NETWORK.edges) {
      expect(getNode(NETWORK, edge.from), `edge ${edge.id} from-node`).toBeDefined();
      expect(getNode(NETWORK, edge.to), `edge ${edge.id} to-node`).toBeDefined();
    }
  });

  it('driving lanes encode two directions (forward + backward) per axis', () => {
    const driving = edgesOfType(NETWORK, 'driving');
    const dirs = new Set(driving.map((e) => e.direction));
    expect(dirs.has('forward')).toBe(true);
    expect(dirs.has('backward')).toBe(true);
  });

  it('parking bays are marked stationary (direction none)', () => {
    const parking = edgesOfType(NETWORK, 'parking');
    expect(parking.every((e) => e.direction === 'none')).toBe(true);
  });

  it('cycling and walking lanes are bidirectional', () => {
    for (const type of ['cycling', 'walking'] as const) {
      const edges = edgesOfType(NETWORK, type);
      expect(edges.every((e) => e.direction === 'both'), type).toBe(true);
    }
  });

  it('every edge records its cardinal axis', () => {
    for (const edge of NETWORK.edges) {
      expect(['north-south', 'east-west']).toContain(edge.axis);
    }
  });
});

describe('RoadNetwork — intersection & signalization', () => {
  it('contains at least one signalized intersection', () => {
    expect(NETWORK.intersections.length).toBeGreaterThanOrEqual(1);
  });

  it('each intersection references nodes that exist in the network', () => {
    for (const ix of NETWORK.intersections) {
      expect(ix.nodeIds.length).toBeGreaterThan(0);
      for (const id of ix.nodeIds) {
        expect(getNode(NETWORK, id), `intersection ${ix.id} node ${id}`).toBeDefined();
      }
    }
  });

  it('the central intersection sits at the block origin', () => {
    const center = NETWORK.intersections[0];
    expect(center.center.x).toBe(0);
    expect(center.center.z).toBe(0);
  });
});

describe('RoadNetwork — building lots', () => {
  it('emits multiple lot footprints around the block perimeter', () => {
    expect(NETWORK.lots.length).toBeGreaterThan(4);
  });

  it('every lot links to an existing sidewalk node', () => {
    for (const lot of NETWORK.lots) {
      const node = getNode(NETWORK, lot.sidewalkNodeId);
      expect(node, `lot ${lot.id} sidewalk node`).toBeDefined();
      expect(node!.laneType).toBe('walking');
    }
  });

  it('every lot records a footprint size and a front axis', () => {
    for (const lot of NETWORK.lots) {
      expect(lot.width).toBeGreaterThan(0);
      expect(lot.depth).toBeGreaterThan(0);
      expect(['north-south', 'east-west']).toContain(lot.frontAxis);
    }
  });

  it('lots sit outside the road surface (storefronts align to sidewalk)', () => {
    for (const lot of NETWORK.lots) {
      // A lot must not overlap the paved road box near the origin.
      const inRoadBox =
        Math.abs(lot.center.x) < 6.5 && Math.abs(lot.center.z) < 6.5;
      expect(inRoadBox, `lot ${lot.id} overlaps the road`).toBe(false);
    }
  });
});
