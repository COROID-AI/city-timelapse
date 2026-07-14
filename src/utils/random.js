// Tiny deterministic PRNG (mulberry32) so each era's city layout is stable.

export class SeededRandom {
  constructor(seed = 1) {
    this.seed = seed >>> 0 || 1;
  }

  next() {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) {
    return a + (b - a) * this.next();
  }

  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  chance(p) {
    return this.next() < p;
  }

  // Pick a stable-ish value per integer index without advancing state.
  unit(i) {
    let t = Math.imul((i + 1) * 0x6d2b79f5, 0x85ebca6b);
    t ^= t >>> 13;
    return ((t >>> 0) % 100000) / 100000;
  }
}
