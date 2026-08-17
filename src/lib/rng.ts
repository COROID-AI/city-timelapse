/** Seeded PRNG using mulberry32 */
export class Rng {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed | 0;
  }

  static fromString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return hash;
  }

  next(): number {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = this.seed ^ (this.seed >>> 15);
    t = (t * 1) | 0;
    t ^= t << 1;
    t ^= t >>> 9;
    return (t >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  bool(prob = 0.5): boolean {
    return this.next() < prob;
  }

  clone(): Rng {
    const copy = new Rng(this.seed);
    // advance internal state to diverge
    copy.next();
    return copy;
  }
}
