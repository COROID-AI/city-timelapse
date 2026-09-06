/**
 * Procedural parts for the 1945 era scene.
 *
 * Everything here is generated at runtime from code — geometry is built from
 * primitives and every painted surface (brick, storefront fascias, war posters,
 * billboards, asphalt, cobblestone) is a `THREE.DataTexture` synthesized into a
 * raw RGBA buffer by {@link PaintBuffer}. The repo stays free of binary assets
 * and the whole module runs headlessly (no DOM / canvas dependency), which is
 * what lets the composition tests assert real integrated behavior in pure Node.
 */
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural paint buffer (node-safe canvas substitute)
// ---------------------------------------------------------------------------

type RGBA = readonly [number, number, number, number?];

/** A tiny set of character bitmaps used to render hand-painted 1940s signage. */
const FONT: Record<string, string[]> = {
  A: ['.###.',
    '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.',
    '#...#', '####.', '#...#', '#...#', '#...#', '####.'],
  C: ['.###.',
    '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.',
    '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####',
    '#....', '####.', '#....', '#....', '#....', '#####'],
  F: ['#####',
    '#....', '####.', '#....', '#....', '#....', '#....'],
  G: ['.###.',
    '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#',
    '#...#', '#####', '#...#', '#...#', '#...#', '#...#'],
  I: ['.###.',
    '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###',
    '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#',
    '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....',
    '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#',
    '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#',
    '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.',
    '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.',
    '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.',
    '#...#', '#...#', '#.#.#', '#..##', '#...#', '.###.'],
  R: ['####.',
    '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####',
    '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####',
    '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#',
    '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#',
    '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#',
    '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#',
    '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#',
    '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####',
    '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.',
    '#..##', '#.#.#', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..',
    '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.',
    '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####',
    '....#', '...#.', '..##.', '....#', '#...#', '.###.'],
  '4': ['...#.',
    '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####',
    '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.',
    '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####',
    '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.',
    '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.',
    '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['.....',
    '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....',
    '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  '-': ['.....',
    '.....', '.....', '#####', '.....', '.....', '.....'],
  "'": ['.#...',
    '.#...', '.#...', '.....', '.....', '.....', '.....'],
  '!': ['..#..',
    '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '&': ['.##..',
    '#..#.', '#.#..', '..#..', '#.#..', '#..#.', '.##.#'],
  ' ': ['.....',
    '.....', '.....', '.....', '.....', '.....', '.....'],
};

/**
 * A work-alike for a 2D canvas backed by a flat RGBA buffer. Text and fills are
 * committed straight to the buffer and handed to three.js as a DataTexture, so
 * no DOM canvas is required (node-test friendly).
 */
export class PaintBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;

  constructor(width: number, height: number, background: RGBA = [248, 244, 234, 255]) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.data = new Uint8Array(this.width * this.height * 4);
    this.fill(0, 0, this.width, this.height, background);
  }

  private idx(x: number, y: number): number {
    return (y * this.width + x) * 4;
  }

  setPixel(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = this.idx(x, y);
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c.length > 3 ? (c[3] as number) : 255;
  }

  fill(x0: number, y0: number, x1: number, y1: number, c: RGBA): void {
    const a = Math.max(0, Math.floor(x0));
    const b = Math.min(this.width, Math.floor(x1));
    const t = Math.max(0, Math.floor(y0));
    const bo = Math.min(this.height, Math.floor(y1));
    for (let y = t; y < bo; y++) {
      for (let x = a; x < b; x++) this.setPixel(x, y, c);
    }
  }

  /** Single-pixel-wide border rectangle. */
  border(x0: number, y0: number, x1: number, y1: number, c: RGBA, thick = 1): void {
    this.fill(x0, y0, x1, y0 + thick, c);
    this.fill(x0, y1 - thick, x1, y1, c);
    this.fill(x0, y0, x0 + thick, y1, c);
    this.fill(x1 - thick, y0, x1, y1, c);
  }

  private glyph(char: string): string[] {
    return FONT[char.toUpperCase()] ?? FONT[' '];
  }

  /** Draw a single text line starting at (x, y); `y` is the glyph top row. */
  drawText(text: string, x: number, y: number, scale: number, c: RGBA, spacing = 6): void {
    const s = Math.max(1, Math.floor(scale));
    let cursor = Math.floor(x);
    for (const ch of text) {
      const glyph = this.glyph(ch);
      for (let row = 0; row < 7; row++) {
        const line = glyph[row] ?? '.....';
        for (let col = 0; col < 5; col++) {
          if (line[col] === '#') {
            this.fill(cursor + col * s, y + row * s, cursor + (col + 1) * s, y + (row + 1) * s, c);
          }
        }
      }
      cursor += spacing * s;
    }
  }

  /** Horizontal center while starting a new line at `y`. */
  drawTextCentered(text: string, cx: number, y: number, scale: number, c: RGBA, spacing = 6): void {
    const s = Math.max(1, Math.floor(scale));
    const charW = (spacing - (spacing - 5)) * s;
    const textW = text.length * charW;
    this.drawText(text, cx - textW / 2, y, s, c, spacing);
  }

  /** Convert the buffer to a clamped three.js DataTexture. */
  toTexture(): THREE.DataTexture {
    const tex = new THREE.DataTexture(this.data, this.width, this.height);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.flipY = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }
}

/** Create a map-ready DataTexture material from a paint buffer or texture. */
function texturedMaterial(bufOrTex: PaintBuffer | THREE.DataTexture, opts: { side?: THREE.Side; emissive?: THREE.ColorRepresentation } = {}): THREE.MeshStandardMaterial {
  const map = bufOrTex instanceof PaintBuffer ? bufOrTex.toTexture() : bufOrTex;
  return new THREE.MeshStandardMaterial({
    map,
    roughness: 0.85,
    metalness: 0.05,
    side: opts.side ?? THREE.FrontSide,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissive === undefined ? 0 : 0.35,
  });
}

// ---------------------------------------------------------------------------
// Texture factories
// ---------------------------------------------------------------------------

function noise(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1000) / 1000;
  };
}

/** Warm, weathered red-brick pattern. */
export function brickTexture(): THREE.DataTexture {
  const w = 128;
  const h = 64;
  const buf = new PaintBuffer(w, h, [140, 74, 58, 255]);
  const rand = noise(7);
  const mortar: RGBA = [178, 160, 138, 255];
  const brickRows = 4;
  const brickH = h / brickRows;
  for (let r = 0; r < brickRows; r++) {
    const offset = r % 2 === 0 ? 0 : w / 2;
    for (let x = -w / 2; x < w + w / 2; x += w / 4) {
      const bcol = 118 + Math.floor(rand() * 46);
      buf.fill(x + offset, r * brickH, x + offset + w / 4 - 2, r * brickH + brickH - 2, [bcol, 62 + Math.floor(rand() * 20), 48, 255]);
    }
  }
  for (let r = 0; r <= brickRows; r++) buf.fill(0, r * brickH - 1, w, r * brickH + 1, mortar);
  for (let x = 0; x < w; x += w / 4) buf.fill(x - 1, 0, x + 1, h, mortar);
  return buf.toTexture();
}

const STORE_META: Record<string, { text: string; fg: RGBA; bg: RGBA; sub: string }> = {
  chemist: { text: 'CHEMIST', fg: [16, 74, 40, 255], bg: [240, 236, 220, 255], sub: 'FINE DRUGS' },
  butcher: { text: 'BUTCHER', fg: [120, 22, 20, 255], bg: [242, 236, 220, 255], sub: 'HOMEBRED MEATS' },
  general: { text: 'GENERAL STORE', fg: [28, 40, 92, 255], bg: [238, 230, 210, 255], sub: 'V FOR VICTORY' },
};

/** Hand-painted shop fascia for the named store. */
export function fasciaTexture(store: string): THREE.DataTexture {
  const meta = STORE_META[store] ?? STORE_META.general;
  const w = 256;
  const h = 64;
  const buf = new PaintBuffer(w, h, meta.bg);
  buf.border(2, 2, w - 2, h - 2, [90, 70, 50, 255], 3);
  buf.border(9, 9, w - 9, h - 9, [150, 120, 90, 255], 2);
  buf.drawTextCentered(meta.text, w / 2, 12, 3, meta.fg, 7);
  buf.drawTextCentered(meta.sub, w / 2, 40, 1, meta.fg);
  buf.drawText('V', w - 30, 26, 3, meta.fg, 7);
  return buf.toTexture();
}

/** Wartime motivational poster. */
export function posterTexture(variant: number): THREE.DataTexture {
  const w = 128;
  const h = 176;
  const palettes: Array<{ bg: RGBA; fg: RGBA; lines: string[] }> = [
    { bg: [120, 24, 26, 255], fg: [250, 246, 230, 255], lines: ['V FOR', 'VICTORY'] },
    { bg: [22, 52, 96, 255], fg: [250, 246, 230, 255], lines: ['BUY WAR', 'BONDS'] },
    { bg: [96, 90, 40, 255], fg: [250, 245, 225, 255], lines: ['DIG FOR', 'VICTORY'] },
    { bg: [50, 66, 52, 255], fg: [250, 245, 225, 255], lines: ["KEEP 'EM", 'ROLLING'] },
  ];
  const p = palettes[variant % palettes.length];
  const buf = new PaintBuffer(w, h, p.bg);
  buf.border(4, 4, w - 4, h - 4, [240, 220, 180, 255], 4);
  const bright: RGBA = [p.bg[0] + 8 > 255 ? 255 : p.bg[0] + 8, p.bg[1], p.bg[2], 255];
  buf.fill(10, 10, w - 10, h - 10, bright);
  buf.drawText('V', 16, 20, 9, p.fg, 11);
  let y = 108;
  for (const line of p.lines) {
    buf.drawTextCentered(line, w / 2, y, 3, p.fg, 7);
    y += 30;
  }
  return buf.toTexture();
}

/** Large 1940s billboard / painted-wall ad. */
export function billboardTexture(listId: number): THREE.DataTexture {
  const w = 256;
  const h = 128;
  const ads: Array<{ bg: RGBA; fg: RGBA; title: string; sub: string }> = [
    { bg: [30, 60, 44, 255], fg: [250, 244, 224, 255], title: "KEEP 'EM FLYING", sub: 'BUY WAR BONDS' },
    { bg: [58, 40, 22, 255], fg: [250, 240, 214, 255], title: 'LUCKY STRIKE', sub: 'FINE TOBACCO' },
    { bg: [40, 44, 70, 255], fg: [250, 242, 220, 255], title: 'EAT AT JOES', sub: 'HOMECOOKED FOOD' },
  ];
  const a = ads[listId % ads.length];
  const buf = new PaintBuffer(w, h, a.bg);
  buf.border(6, 6, w - 6, h - 6, a.fg, 4);
  buf.drawTextCentered(a.title, w / 2, 24, 4, a.fg, 8);
  buf.drawTextCentered(a.sub, w / 2, 72, 3, a.fg, 7);
  buf.drawTextCentered('19 45', w / 2, 104, 1, a.fg, 7);
  return buf.toTexture();
}

/** Asphalt paving with age cracks and patched tar seams. */
export function asphaltTexture(): THREE.DataTexture {
  const w = 128;
  const h = 128;
  const buf = new PaintBuffer(w, h, [46, 48, 52, 255]);
  const rand = noise(21);
  for (let i = 0; i < 600; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    const v = 30 + Math.floor(rand() * 40);
    buf.fill(x, y, x + 1, y + 1, [v, v + 2, v + 6, 255]);
  }
  for (let i = 0; i < 5; i++) {
    const cx = Math.floor(rand() * w);
    buf.fill(cx, 0, cx + 1, h, [24, 25, 28, 255]);
  }
  buf.border(Math.floor(w / 2) - 8, Math.floor(h / 2) - 8, Math.floor(w / 2) + 8, Math.floor(h / 2) + 8, [30, 32, 36, 255], 2);
  return buf.toTexture();
}

/** Cobblestone: rounded stone street blocks with mortar gaps. */
export function cobblestoneTexture(): THREE.DataTexture {
  const w = 128;
  const h = 96;
  const buf = new PaintBuffer(w, h, [52, 50, 46, 255]);
  const rand = noise(33);
  const cols = 8;
  const rows = 6;
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = c * cw + 2;
      const oy = r * ch + 2;
      const tone = 78 + Math.floor(rand() * 60);
      buf.fill(ox, oy, ox + cw - 4, oy + ch - 4, [tone, tone - 4, tone - 9, 255]);
      buf.fill(ox, oy, ox + cw - 4, oy + 4, [tone + 18, tone + 14, tone + 8, 255]);
      buf.fill(ox, oy + ch - 8, ox + cw - 4, oy + ch - 4, [tone - 22, tone - 24, tone - 28, 255]);
    }
  }
  return buf.toTexture();
}

/** Gas lamp cast iron (dark, glossy body + warm lantern). */
export function lamppostGroup(): THREE.Group {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.4, metalness: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 5.6, 8), iron);
  pole.position.y = 2.8;
  g.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.5, 8), iron);
  base.position.y = 0.25;
  g.add(base);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), iron);
  arm.rotation.z = -0.5;
  arm.position.set(0.35, 5.3, 0);
  g.add(arm);
  const lanternFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), iron);
  lanternFrame.position.set(0.75, 5.35, 0);
  g.add(lanternFrame);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.34, 0.34),
    new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffa030, emissiveIntensity: 0.9, roughness: 0.4 }),
  );
  glass.position.set(0.75, 5.35, 0);
  g.add(glass);
  return g;
}

/** Utility pole with crossarm and knurled crossbucks. */
export function telephonePoleGroup(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a5644, roughness: 0.95 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 9.5, 8), wood);
  trunk.position.y = 4.75;
  g.add(trunk);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), wood);
  arm.position.y = 8.0;
  g.add(arm);
  const arm2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), wood);
  arm2.position.y = 8.6;
  g.add(arm2);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), wood);
  brace.position.set(0.8, 7.7, 0);
  brace.rotation.z = 0.5;
  g.add(brace);
  const porc = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 1 });
  for (const x of [-1, 0, 1]) {
    for (const y of [8.0, 8.6]) {
      const ins = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), porc);
      ins.position.set(x, y, 0);
      g.add(ins);
    }
  }
  return g;
}

/** Stack of sandbags piled against a wall on a corner. */
export function sandbagStack(width = 1.1): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xa88b54, roughness: 0.95 });
  const bagW = 0.46;
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const count = Math.max(1, Math.floor(width / bagW - r));
    for (let i = 0; i < count; i++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(bagW, 0.22, 0.42), mat);
      const off = ((count - 1) * bagW) / 2;
      bag.position.set(-off + i * bagW, 0.11 + r * 0.2, 0);
      bag.rotation.y = (i % 2) * 0.08;
      g.add(bag);
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Building construction
// ---------------------------------------------------------------------------

export interface BuildingSlot {
  x: number;
  width: number;
  floors: number;
  store?: 'chemist' | 'butcher' | 'general';
  /** front-of-facade z plane (world). */
  facadeZ: number;
  /** building depth (z extent). */
  depth: number;
}

const FRONT_FACADE_Z = -40;

function windowUnit(y: number, width: number, dark: boolean): THREE.Group {
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(width, 1.0, 0.08), frameMat);
  frame.position.set(0, y, 0.2);
  g.add(frame);
  const glassMat = dark
    ? new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.2, metalness: 0.4 })
    : new THREE.MeshStandardMaterial({ color: 0x2c3648, roughness: 0.3, metalness: 0.1 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(width - 0.24, 0.78, 0.05), glassMat);
  glass.position.set(0, y, 0.24);
  g.add(glass);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.06, 0.16), frameMat);
  sill.position.set(0, y - 0.52, 0.14);
  g.add(sill);
  return g;
}

/** Rough blackout cover boarding over a window (wartime remnant). */
function blackoutPanel(y: number, width: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a3a34, roughness: 0.95 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, 0.86, 0.1), mat);
  panel.position.set(0, y, 0.28);
  g.add(panel);
  const brace = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.1, 0.05), mat);
  brace.position.set(0, y, 0.33);
  g.add(brace);
  return g;
}

/** A roof-top anti-launch pigeon / window soot pipe for ambience. */
function chimney(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.4, 6), mat);
  body.position.set(x, y, z);
  g.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.18, 6), mat);
  cap.position.set(x, y + 0.7, z);
  g.add(cap);
  return g;
}

/**
 * Build one brick/row building. When a `store` is supplied a full shopfront is
 * appended: glass display windows, a door, a hand-painted fascia and a period
 * striped awning — all tagged with the `storefront` category.
 */
export function buildBuilding(slot: BuildingSlot, brickTex: THREE.DataTexture): THREE.Group {
  const facadeZ = slot.facadeZ ?? FRONT_FACADE_Z;
  const depth = slot.depth ?? 14;
  const b = new THREE.Group();
  b.userData.category = 'building';

  const brickMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.9 });
  const storeyH = 3.3;
  const parapet = 0.6;
  const height = slot.floors * storeyH + parapet;
  const centerZ = facadeZ - depth / 2;

  const body = new THREE.Mesh(new THREE.BoxGeometry(slot.width, height, depth), brickMat);
  body.position.set(slot.x, height / 2, centerZ);
  b.add(body);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(slot.width + 0.3, 0.3, depth + 0.3), brickMat);
  roof.position.set(slot.x, height + 0.15, centerZ);
  b.add(roof);

  for (const cx of [-slot.width * 0.25, slot.width * 0.3]) {
    b.add(chimney(slot.x + cx, height + 0.6, centerZ - depth * 0.2));
  }

  // Upper-floor windows on the front facade, some blacked-out.
  const windowCols = Math.max(2, Math.floor(slot.width / 5));
  for (let floor = 1; floor < slot.floors; floor++) {
    const wy = slot.store ? storeyH - 0.6 + floor * storeyH : storeyH * floor + 0.6;
    for (let i = 0; i < windowCols; i++) {
      const wx = slot.x - slot.width / 2 + (slot.width * (i + 0.5)) / windowCols;
      const dark = (floor + i) % 3 === 0;
      const unit = windowUnit(wy, 1.15, dark);
      unit.position.set(wx, 0, facadeZ);
      b.add(unit);
      if ((floor * 7 + i) % 5 === 0) {
        const bp = blackoutPanel(wy, 1.1);
        bp.position.set(wx, 0, facadeZ);
        bp.userData.category = 'blackout';
        b.add(bp);
      }
    }
  }

  // Storefront (ground floor) for the three listed stores.
  if (slot.store) {
    const sf = new THREE.Group();
    sf.userData.category = 'storefront';
    sf.position.set(slot.x, 0, facadeZ);

    const shop = new THREE.Mesh(
      new THREE.BoxGeometry(slot.width - 1.5, storeyH + 0.4, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9 }),
    );
    shop.position.set(0, (storeyH + 0.4) / 2, 0);
    sf.add(shop);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x24364a,
      roughness: 0.2,
      metalness: 0.4,
      transparent: true,
      opacity: 0.85,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xcfc3a8, roughness: 0.6 });
    const dispW = (slot.width - 4) / 2;
    for (let side = 0; side < 2; side++) {
      const off = side === 0 ? -1 : 1;
      const win = new THREE.Mesh(new THREE.BoxGeometry(dispW, 1.9, 0.08), glassMat);
      win.position.set(slot.width * (off * 0.24), 1.1, 0.5);
      sf.add(win);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(dispW + 0.14, 1.98, 0.1), frameMat);
      fr.position.set(slot.width * (off * 0.24), 1.1, 0.54);
      sf.add(fr);
    }

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.16), new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.8 }));
    door.position.set(0, 1.0, 0.6);
    sf.add(door);
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.1, 0.06), frameMat);
    doorFrame.position.set(0, 1.05, 0.55);
    sf.add(doorFrame);

    const fascia = new THREE.Mesh(new THREE.BoxGeometry(slot.width, 0.62, 0.22), texturedMaterial(fasciaTexture(slot.store)));
    fascia.position.set(0, storeyH - 0.1, 0.62);
    sf.add(fascia);

    const awning = awningMesh(slot.width);
    awning.position.set(0, storeyH - 0.55, -0.4);
    sf.add(awning);

    b.add(sf);

    const stack = sandbagStack(slot.width - 2);
    stack.position.set(0, 0, 0.45);
    stack.userData.category = 'sandbag';
    sf.add(stack);
  }

  return b;
}

function awningMesh(width: number): THREE.Group {
  const g = new THREE.Group();
  const canvas = new THREE.MeshStandardMaterial({ color: 0xd8b24a, roughness: 0.9 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xb8402a, roughness: 0.9 });
  const segs = Math.max(2, Math.floor(width / 1.4));
  const segW = width / segs;
  for (let i = 0; i < segs; i++) {
    const m = i % 2 === 0 ? canvas : stripeMat;
    const s = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.12, 1.3), m);
    s.position.set(-width / 2 + segW * i + segW / 2, 0, 0.55);
    g.add(s);
  }
  const val = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, 0.08), stripeMat);
  val.position.set(0, -0.1, 1.15);
  g.add(val);
  return g;
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

function wheel(r: number, width: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, width, 10),
    new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.7 }),
  );
}

/** 1940s sedan (rounded, chrome accents). */
export function sedanMesh(color: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.2, metalness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 1.9), paint);
  body.position.y = 0.75;
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 1.7), paint);
  cabin.position.set(-0.1, 1.4, 0);
  g.add(cabin);

  const cabinGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.5, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x9fc9e0, roughness: 0.1, metalness: 0.9 }),
  );
  cabinGlass.position.set(-0.05, 1.45, 0);
  g.add(cabinGlass);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 1.4), chrome);
  grille.position.set(2.35, 0.62, 0);
  g.add(grille);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 1.3), chrome);
  tail.position.set(-2.35, 0.62, 0);
  g.add(tail);

  for (const z of [-0.92, 0.92]) {
    for (const x of [-1.3, 1.3]) {
      const wEl = wheel(0.42, 0.24);
      wEl.rotation.x = Math.PI / 2;
      wEl.position.set(x, 0.42, z);
      g.add(wEl);
    }
  }
  return g;
}

/** 1940s delivery truck with lettered cargo box. */
export function truckMesh(): THREE.Group {
  const g = new THREE.Group();
  const cab = new THREE.MeshStandardMaterial({ color: 0x3f5a3a, roughness: 0.6 });
  const body = new THREE.MeshStandardMaterial({ color: 0xe7dcc0, roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.8 });

  const cabBox = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.8, 2.0), cab);
  cabBox.position.set(0.6, 1.55, 0);
  g.add(cabBox);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 2.0), cab);
  hood.position.set(1.9, 0.6, 0);
  g.add(hood);

  const box = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 2.1), body);
  box.position.set(-1.7, 1.7, 0);
  g.add(box);

  const buf = new PaintBuffer(256, 64, [231, 220, 192, 255]);
  buf.drawText('VICTORY', 26, 12, 3, [60, 40, 30, 255], 7);
  buf.drawTextCentered('DELIVERY', 128, 42, 2, [90, 70, 50, 255], 7);
  const letter = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), texturedMaterial(buf));
  letter.position.set(-1.7, 2.0, 1.06);
  g.add(letter);

  for (const z of [-0.92, 0.92]) {
    for (const x of [-2.7, 0.1, 2.6]) {
      const wEl = wheel(0.42, 0.24);
      wEl.rotation.x = Math.PI / 2;
      wEl.position.set(x, 0.42, z);
      g.add(wEl);
    }
  }
  for (const z of [-1.05, 1.05]) {
    const run = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.12, 0.08), trim);
    run.position.set(-0.5, 0.5, z);
    g.add(run);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Pedestrians
// ---------------------------------------------------------------------------

export type OutfitId = 'man-suit' | 'man-cap' | 'woman-dress' | 'woman-coat' | 'child';

export interface OutfitSpec {
  id: OutfitId;
  label: string;
  coat: THREE.ColorRepresentation;
  pants: THREE.ColorRepresentation;
  hat?: THREE.ColorRepresentation;
  skirt?: THREE.ColorRepresentation;
}

const OUTFITS: readonly OutfitSpec[] = [
  { id: 'man-suit', label: 'Man in suit & fedora', coat: 0x3a4446, pants: 0x2c2c30, hat: 0x2c2c30 },
  { id: 'man-suit', label: 'Man in suit & fedora', coat: 0x4a3a2a, pants: 0x33302a, hat: 0x4a3a2a },
  { id: 'man-cap', label: 'Worker in flat cap', coat: 0x55604a, pants: 0x3c4036, hat: 0x3c4036 },
  { id: 'woman-dress', label: 'Woman in day dress', coat: 0x7a4a52, pants: 0x7a4a52, skirt: 0x7a4a52 },
  { id: 'woman-coat', label: 'Woman in wool coat', coat: 0x2f3a4a, pants: 0x2f3a4a, skirt: 0x2f3a4a },
  { id: 'child', label: 'Child', coat: 0xa25b3a, pants: 0x3a3f44 },
];

function boxMesh(g: THREE.Group, mat: THREE.Material, wp: THREE.Vector3, sz: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sz.x, sz.y, sz.z), mat);
  mesh.position.copy(wp);
  g.add(mesh);
  return mesh;
}

/** Build one stylised pedestrian in period clothing. */
export function pedestrianMesh(spec: OutfitSpec): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8b08a, roughness: 0.8 });
  const coat = new THREE.MeshStandardMaterial({ color: spec.coat, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: spec.pants, roughness: 0.85 });
  const scale = spec.id === 'child' ? 0.55 : 1.0;

  // legs
  boxMesh(g, pants, new THREE.Vector3(-0.1, 0.28, 0).multiplyScalar(1), new THREE.Vector3(0.11, 0.5, 0.18).multiplyScalar(scale));
  boxMesh(g, pants, new THREE.Vector3(0.1, 0.28, 0), new THREE.Vector3(0.11, 0.5, 0.18).multiplyScalar(scale));

  // torso / skirt
  if (spec.skirt) {
    boxMesh(g, new THREE.MeshStandardMaterial({ color: spec.skirt, roughness: 0.8 }),
      new THREE.Vector3(0, 0.65, 0), new THREE.Vector3(0.34, 0.34, 0.26).multiplyScalar(scale));
    boxMesh(g, coat, new THREE.Vector3(0, 1.02, 0), new THREE.Vector3(0.26, 0.4, 0.2).multiplyScalar(scale));
  } else {
    boxMesh(g, coat, new THREE.Vector3(0, 0.8, 0), new THREE.Vector3(0.28, 0.56, 0.2).multiplyScalar(scale));
  }
  // arms
  boxMesh(g, coat, new THREE.Vector3(-0.22, 0.8, 0), new THREE.Vector3(0.07, 0.5, 0.1).multiplyScalar(scale));
  boxMesh(g, coat, new THREE.Vector3(0.22, 0.8, 0), new THREE.Vector3(0.07, 0.5, 0.1).multiplyScalar(scale));

  // head
  const headScale = scale === 0.55 ? 0.62 : 1.0;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin);
  head.position.set(0, 1.32 * headScale, 0);
  g.add(head);

  // hat
  if (spec.hat) {
    const hatMat = new THREE.MeshStandardMaterial({ color: spec.hat, roughness: 0.7 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 10), hatMat);
    brim.position.y = 1.4 * scale;
    g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.16, 10), hatMat);
    crown.position.y = 1.5 * scale;
    g.add(crown);
  }
  return g;
}

export { OUTFITS };

// ---------------------------------------------------------------------------
// Providers handed to the simulation (main-integration)
// ---------------------------------------------------------------------------

export interface OutfitVariant {
  id: string;
  label: string;
  build: () => THREE.Group;
}

export interface VehicleVariant {
  id: string;
  label: string;
  build: () => THREE.Group;
}

/** Pedestrian outfit variants + vehicle meshes for the sim to instantiate. */
export interface Era1945Providers {
  era: '1945';
  name: string;
  pedestrianOutfits: OutfitVariant[];
  vehicles: VehicleVariant[];
}

export const era1945Providers: Era1945Providers = {
  era: '1945',
  name: 'Immediate post-war austerity (1945)',
  pedestrianOutfits: OUTFITS.map((o) => ({ id: o.id, label: o.label, build: () => pedestrianMesh(o) })),
  vehicles: [
    { id: 'sedan-1945', label: '1940s sedan', build: () => sedanMesh(0x1f2b2e) },
    { id: 'sedan-1945b', label: '1940s sedan (forest)', build: () => sedanMesh(0x2c3a26) },
    { id: 'delivery-truck-1945', label: 'Delivery truck', build: () => truckMesh() },
  ],
};