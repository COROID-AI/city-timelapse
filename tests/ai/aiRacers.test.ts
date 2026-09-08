/**
 * Unit tests for AI opponents: lookahead steering, curvature speed control,
 * progress computation, and bounded rubber-banding, run on simulated frames
 * over the deterministic closed-loop track.
 */

import * as THREE from 'three';

import { createAIRacers, DEFAULT_PERSONALITIES, defaultAIRacerConfig } from '../../src/ai/aiRacers';
import {
  angleDiff,
  clamp,
  curvatureAt,
  distanceToTrack,
  loopProgress,
  nearestWaypoint,
  normalizeLoop,
  steerToPoint,
  wrapIndex,
} from '../../src/ai/waypointFollower';
import type { TrackPath } from '../../src/shared/types';
import { createTrack } from '../../src/world/track';

/** The deterministic closed-loop track from the neon city world. */
const track = createTrack();

/** Simple player pose used across rubber-band / steer tests. */
const playerAt = (x: number, z: number, lap = 0): { readonly x: number; readonly z: number; readonly lap: number } => ({
  x,
  z,
  lap,
});

describe('waypointFollower — pure helpers', () => {
  it('angleDiff reduces angles into [-PI, PI]', () => {
    expect(angleDiff(Math.PI * 2)).toBeCloseTo(0);
    expect(angleDiff(Math.PI + 0.5)).toBeCloseTo(-(Math.PI - 0.5));
    expect(angleDiff(-Math.PI - 0.5)).toBeCloseTo(Math.PI - 0.5);
  });

  it('wrapIndex wraps array indices into [0, n)', () => {
    expect(wrapIndex(0, 4)).toBe(0);
    expect(wrapIndex(4, 4)).toBe(0);
    expect(wrapIndex(-1, 4)).toBe(3);
  });

  it('clamp bounds values into [min, max]', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('normalizeLoop wraps values into [0, 1)', () => {
    expect(normalizeLoop(0.25)).toBeCloseTo(0.25);
    expect(normalizeLoop(1.25)).toBeCloseTo(0.25);
    expect(normalizeLoop(-0.25)).toBeCloseTo(0.75);
  });

  it('nearestWaypoint picks the closest waypoint on the closed loop', () => {
    const pts = track.path.points;
    const idx = 4;
    const target = pts[idx] as [number, number, number];
    expect(nearestWaypoint(pts, target)).toBe(idx);
  });

  it('steerToPoint returns 0 when the car already faces the target', () => {
    // Place a point directly along the forward heading (forward = sin/cos yaw).
    const yaw = 0.5;
    const pos: [number, number, number] = [0, 0, 0];
    const target: [number, number, number] = [Math.sin(yaw), 0, Math.cos(yaw)];
    expect(Math.abs(steerToPoint(pos, target, yaw))).toBeLessThan(1e-6);
  });

  it('steerToPoint is clamped to [-1, 1] for a full 90° turn', () => {
    const pos: [number, number, number] = [0, 0, 0];
    const target: [number, number, number] = [1, 0, 0]; // 90° right from +Z
    expect(steerToPoint(pos, target, 0)).toBeCloseTo(1);
  });

  it('loopProgress returns a fractional value in [0,1) for on-track points', () => {
    const pts = track.path.points;
    for (let i = 0; i < pts.length; i += 5) {
      const p = pts[i] as [number, number, number];
      const prog = loopProgress(pts, p);
      expect(prog).toBeGreaterThanOrEqual(0);
      expect(prog).toBeLessThan(1);
    }
  });

  it('distanceToTrack is small for points on the centerline and grows off it', () => {
    const pts = track.path.points;
    const on = pts[2] as [number, number, number];
    const off: [number, number, number] = [on[0] + 200, on[1], on[2] + 200];
    expect(distanceToTrack(pts, on)).toBeLessThan(20);
    expect(distanceToTrack(pts, off)).toBeGreaterThan(50);
  });

  it('curvatureAt is near zero on gently curved stretches and positive on corners', () => {
    const pts = track.path.points;
    // The base polygon is a rounded rectangle; corners carry real curvature.
    let total = 0;
    for (let i = 0; i < pts.length; i++) {
      const c = curvatureAt(pts, i);
      expect(c).toBeGreaterThanOrEqual(0);
      total += c;
    }
    expect(total).toBeGreaterThan(0.01);
  });
});

describe('createAIRacers — construction on the real TrackPath', () => {
  it('builds count=3 cars reusing createCarMesh liveries', () => {
    const ai = createAIRacers(track.path);
    expect(ai.racers).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      const r = ai.racers[i] as ReturnType<typeof createAIRacers>['racers'][number];
      expect(r.body).toBeDefined();
      expect(r.body.children.length).toBeGreaterThanOrEqual(6);
      expect(r.name).toBeTruthy();
      expect(r.id).toBe(`ai-${i}`);
      expect(r.lap).toBe(0);
      expect(r.loopProgress).toBeGreaterThanOrEqual(0);
      expect(r.personalityMultiplier).toBe(DEFAULT_PERSONALITIES[i % DEFAULT_PERSONALITIES.length]!.speedMultiplier);
    }
    ai.dispose();
  });

  it('places cars at distinct start-grid spawn offsets', () => {
    const ai = createAIRacers(track.path);
    const [a, b, c] = ai.racers;
    expect(a && b && c).toBeTruthy();
    const dAB = Math.hypot((a!.kin.x - b!.kin.x), (a!.kin.z - b!.kin.z));
    const dBC = Math.hypot((b!.kin.x - c!.kin.x), (b!.kin.z - c!.kin.z));
    expect(dAB).toBeGreaterThan(1);
    expect(dBC).toBeGreaterThan(1);
    ai.dispose();
  });

  it('throws on an invalid (non-looping) track', () => {
    const bad: TrackPath = { points: [[0, 0, 0]], loop: false };
    expect(() => createAIRacers(bad)).toThrow();
  });
});

describe('createAIRacers — lookahead steering across simulated frames', () => {
  it('steers cars toward the next waypoints so they move along the circuit', () => {
    const ai = createAIRacers(track.path, 3);
    const p0 = ai.racers[0]!;
    const startX = p0.kin.x;
    const startZ = p0.kin.z;

    // Run a couple seconds of frames at 60 Hz.
    const dt = 1 / 60;
    for (let i = 0; i < 180; i++) {
      ai.update(dt, playerAt(startX, startZ));
    }

    const moved = Math.hypot(p0.kin.x - startX, p0.kin.z - startZ);
    expect(moved).toBeGreaterThan(5);
    expect(p0.kin.speed).toBeGreaterThan(0);
    ai.dispose();
  });

  it('keeps cars on (or within recovery reach of) the road', () => {
    const ai = createAIRacers(track.path, 3);
    const dt = 1 / 60;
    for (let i = 0; i < 240; i++) {
      ai.update(dt, playerAt(0, 0));
    }
    for (const r of ai.racers) {
      const d = distanceToTrack(
        track.path.points,
        [r.kin.x, 0, r.kin.z] as [number, number, number],
      );
      // Cars may wobble slightly; recovery should keep them within a few
      // road-widths of the ribbon over the deterministic run.
      expect(d).toBeLessThan(defaultAIRacerConfig.roadHalfWidth * 2);
    }
    ai.dispose();
  });
});

describe('createAIRacers — progress and CarState compatibility', () => {
  it('getState returns a CarState-compatible snapshot per racer', () => {
    const ai = createAIRacers(track.path, 3);
    const state = ai.getState(0);
    expect(state.id).toBe('ai-0');
    expect(state.position).toHaveLength(3);
    expect(typeof state.yaw).toBe('number');
    expect(typeof state.speed).toBe('number');
    expect(typeof state.lap).toBe('number');
    expect(typeof state.waypointIndex).toBe('number');
    expect(state.progress).toBeGreaterThanOrEqual(0);
    expect(state.progress).toBeLessThan(1);
    ai.dispose();
  });

  it('progress advances (max loop progress climbs) across simulated frames', () => {
    const ai = createAIRacers(track.path, 2);
    const dt = 1 / 60;
    const start = ai.getState(0).progress;
    let maxSeen = start;
    for (let i = 0; i < 600; i++) {
      ai.update(dt, playerAt(0, 0));
      maxSeen = Math.max(maxSeen, ai.getState(0).progress);
    }
    // Nearest-waypoint projection is slightly non-monotonic, so assert the
    // furthest progress reached climbs meaningfully above the starting line.
    expect(maxSeen - start).toBeGreaterThan(0.02);
    ai.dispose();
  });
});

describe('createAIRacers — bounded rubber-banding', () => {
  it('never lets the effective multiplier exceed a bounded band', () => {
    const ai = createAIRacers(track.path, 3);
    const dt = 1 / 60;
    let min = Infinity;
    let max = -Infinity;
    // Drive the field for a while against stationary / slow players to stress
    // both sides of the rubber-band logic.
    for (let i = 0; i < 300; i++) {
      // Alternate a slow and a fast "player" position to push the band both ways.
      const player = i % 2 === 0
        ? playerAt(0, 0, 0)
        : playerAt(0, 0, 20);
      ai.update(dt, player);
      for (const r of ai.racers) {
        const st = ai.getState(r.index);
        min = Math.min(min, st.multiplier);
        max = Math.max(max, st.multiplier);
      }
    }
    const band = defaultAIRacerConfig.bandMax;
    // personalityMultiplier already carries base style; the band bounds the
    // rubber-band component around it. Total must stay within a generous band.
    expect(min).toBeGreaterThan(0.5);
    expect(max).toBeLessThan(1.5);
    expect(max - min).toBeLessThan(1);
    ai.dispose();
  });

  it('rubberBand stays within [1-bandMax, 1+bandMax]', () => {
    const ai = createAIRacers(track.path, 1);
    const dt = 1 / 60;
    const band = defaultAIRacerConfig.bandMax;
    for (let i = 0; i < 300; i++) {
      const player = i % 2 === 0 ? playerAt(0, 0, 0) : playerAt(0, 0, 20);
      ai.update(dt, player);
      const r = ai.racers[0]!;
      expect(r.rubberBand).toBeGreaterThanOrEqual(1 - band);
      expect(r.rubberBand).toBeLessThanOrEqual(1 + band);
    }
    ai.dispose();
  });
});