/**
 * Deterministic city layout. Generated once at module load from a fixed seed so
 * the block is identical every run (and the deterministic reset/focus lands on
 * the same camera). Building footprints are fixed across eras so variants
 * crossfade *in place* — only heights/styles/colors differ per era.
 */

export const EXTENT = 38
const GRID = 4
const PITCH = (2 * EXTENT) / GRID // 19

export interface Slot {
  x: number
  z: number
  w: number
  d: number
  rot: number
  seed: number
}

/** Seeded PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Building footprints — fixed across eras. */
export const SLOTS: Slot[] = (() => {
  const rng = mulberry32(1337)
  const out: Slot[] = []
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const cx = -EXTENT + PITCH / 2 + i * PITCH
      const cz = -EXTENT + PITCH / 2 + j * PITCH
      out.push({
        x: cx,
        z: cz,
        w: 11 + rng() * 3,
        d: 11 + rng() * 3,
        rot: (rng() - 0.5) * 0.18,
        seed: Math.floor(rng() * 1e9),
      })
    }
  }
  return out
})()

/** Road centre-line coordinates (axis-aligned). */
export const ROAD_COORDS: number[] = (() => {
  const a: number[] = []
  for (let k = 0; k <= GRID; k++) a.push(-EXTENT + k * PITCH)
  return a
})()

/** Half road width (lane offset uses this). */
export const ROAD_HALF = 3.2

/**
 * Vehicle lanes: each road coordinate yields an x-lane and a z-lane, offset to
 * the right-hand side. Edge roads are skipped so traffic stays inside the map.
 */
export interface Lane {
  axis: 'x' | 'z'
  fixed: number
  dir: 1 | -1
}
export const LANES: Lane[] = (() => {
  const out: Lane[] = []
  for (let k = 1; k < ROAD_COORDS.length - 1; k++) {
    const c = ROAD_COORDS[k]
    out.push({ axis: 'x', fixed: c - ROAD_HALF * 0.55, dir: 1 })
    out.push({ axis: 'x', fixed: c + ROAD_HALF * 0.55, dir: -1 })
    out.push({ axis: 'z', fixed: c - ROAD_HALF * 0.55, dir: 1 })
    out.push({ axis: 'z', fixed: c + ROAD_HALF * 0.55, dir: -1 })
  }
  return out
})()

/** Sidewalk paths for pedestrians: parallel to each interior road. */
export interface WalkPath {
  axis: 'x' | 'z'
  fixed: number
}
export const WALKS: WalkPath[] = (() => {
  const out: WalkPath[] = []
  for (let k = 1; k < ROAD_COORDS.length - 1; k++) {
    const c = ROAD_COORDS[k]
    out.push({ axis: 'x', fixed: c - ROAD_HALF - 1.4 })
    out.push({ axis: 'x', fixed: c + ROAD_HALF + 1.4 })
    out.push({ axis: 'z', fixed: c - ROAD_HALF - 1.4 })
    out.push({ axis: 'z', fixed: c + ROAD_HALF + 1.4 })
  }
  return out
})()
