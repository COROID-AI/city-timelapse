/**
 * Unit tests for the closed-loop street circuit: curve closure, checkpoint
 * spacing, start/finish line, determinism, and nearest-checkpoint lookups.
 */

import * as THREE from 'three';
import {
  createTrack,
  CHECKPOINT_COUNT,
  mulberry32,
} from '../../src/world/track';

describe('createTrack closed-loop circuit', () => {
  it('produces a closed loop (start equals end)', () => {
    const track = createTrack();
    const start = track.getPoint(0);
    const end = track.getPoint(1);
    expect(start.distanceTo(end)).toBeLessThan(1e-4);
  });

  it('marks the shared TrackPath contract as a loop', () => {
    const track = createTrack();
    expect(track.path.loop).toBe(true);
    expect(track.path.points.length).toBeGreaterThanOrEqual(8);
    // Every waypoint is a valid Vec3 tuple.
    for (const p of track.path.points) {
      expect(p).toHaveLength(3);
      expect(typeof p[0]).toBe('number');
    }
  });

  it('spaces checkpoints evenly by arc length', () => {
    const track = createTrack();
    expect(track.checkpointCount).toBe(CHECKPOINT_COUNT);
    expect(track.checkpoints).toHaveLength(CHECKPOINT_COUNT);

    // Chord lengths between consecutive checkpoints should be nearly equal.
    const gaps: number[] = [];
    for (let i = 0; i < track.checkpoints.length; i++) {
      const a = track.checkpoints[i] as THREE.Vector3;
      const b = track.checkpoints[(i + 1) % track.checkpoints.length] as THREE.Vector3;
      gaps.push(a.distanceTo(b));
    }
    const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    for (const g of gaps) {
      // Evenly arc-length-spaced points on a smooth curve have near-equal
      // chord lengths; allow a small tolerance for curvature.
      expect(g).toBeGreaterThan(0);
      expect(Math.abs(g - mean)).toBeLessThan(mean * 0.1);
    }
  });

  it('places the start/finish line at checkpoint 0 with a valid frame', () => {
    const track = createTrack();
    const line = track.startLine;
    expect(line.position.distanceTo(track.checkpoints[0] as THREE.Vector3)).toBeLessThan(1e-4);
    // tangent and right must be unit length and perpendicular.
    expect(line.tangent.length()).toBeCloseTo(1, 5);
    expect(line.right.length()).toBeCloseTo(1, 5);
    expect(Math.abs(line.tangent.dot(line.right))).toBeLessThan(1e-4);
  });

  it('is deterministic across calls with the same seed', () => {
    const a = createTrack(42);
    const b = createTrack(42);
    expect(a.checkpoints.length).toBe(b.checkpoints.length);
    for (let i = 0; i < a.checkpoints.length; i++) {
      const pa = a.checkpoints[i] as THREE.Vector3;
      const pb = b.checkpoints[i] as THREE.Vector3;
      expect(pa.distanceTo(pb)).toBeLessThan(1e-9);
    }
  });

  it('varies layout across different seeds', () => {
    const a = createTrack(1);
    const b = createTrack(2);
    // Some checkpoint should differ meaningfully between seeds.
    let differs = false;
    for (let i = 0; i < a.checkpoints.length; i++) {
      const d = (a.checkpoints[i] as THREE.Vector3).distanceTo(b.checkpoints[i] as THREE.Vector3);
      if (d > 1) differs = true;
    }
    expect(differs).toBe(true);
  });

  it('finds the nearest checkpoint to a position on the loop', () => {
    const track = createTrack();
    // A point exactly on checkpoint 3 should resolve to index 3.
    const target = track.checkpoints[3] as THREE.Vector3;
    expect(track.nearestCheckpoint(target)).toBe(3);
  });

  it('mulberry32 is pure and reproducible', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});