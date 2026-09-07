import { BoxGeometry, Color, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { ERA_1965_PALETTE } from './palette';

/**
 * Procedural mesh builder and material styling helpers for 1965 mid-century boom assets.
 */

export interface MaterialOptions {
  color?: number | Color;
  emissive?: number | Color;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
}

/**
 * Creates a standard material configured for 1965 Technicolor rendering.
 */
export function createMaterial(colorHex: number): MeshStandardMaterial {
  const mat = new MeshStandardMaterial();
  mat.color.setHex(colorHex);
  return mat;
}

/**
 * Creates a standard box mesh with given dimensions and color.
 */
export function createBox(
  w: number,
  h: number,
  d: number,
  colorHex: number,
  posX = 0,
  posY = 0,
  posZ = 0,
): Mesh {
  const geom = new BoxGeometry(w, h, d);
  const mat = createMaterial(colorHex);
  const mesh = new Mesh(geom, mat);
  mesh.position.set(posX, posY, posZ);
  return mesh;
}

/**
 * Billboard visual definition and generic 1960s ad copy descriptors.
 */
export interface BillboardArtwork {
  readonly id: string;
  readonly title: string;
  readonly slogan: string;
  readonly primaryColor: number;
  readonly secondaryColor: number;
  readonly accentColor: number;
  readonly category: 'car' | 'cigarette' | 'airline' | 'television';
}

export const BILLBOARD_ARTWORKS_1965: readonly BillboardArtwork[] = Object.freeze([
  {
    id: 'ad-v8-cruiser',
    title: 'AERO-V8 SUPER CONVERTIBLE',
    slogan: 'Feel the Jet-Age Power! Wide Fins, Pure Luxury.',
    primaryColor: ERA_1965_PALETTE.vehicles.finnedSedanCherryRed,
    secondaryColor: ERA_1965_PALETTE.architecture.signBandWhite,
    accentColor: ERA_1965_PALETTE.vehicles.convertibleCanaryYellow,
    category: 'car',
  },
  {
    id: 'ad-golden-filter',
    title: 'GOLDEN FILTER CIGARETTES',
    slogan: 'Smooth, Satisfying, Rich Virginia Blend.',
    primaryColor: 0x1d3557,
    secondaryColor: 0xffd166,
    accentColor: 0xe63946,
    category: 'cigarette',
  },
  {
    id: 'ad-pan-world',
    title: 'PAN-CONTINENTAL JETS',
    slogan: 'Fly Non-Stop to the Future at 600 MPH!',
    primaryColor: 0x0077b6,
    secondaryColor: 0xffffff,
    accentColor: 0xf77f00,
    category: 'airline',
  },
  {
    id: 'ad-color-vision',
    title: 'COLOR-VISION CRT CONSOLE',
    slogan: 'Living Color in Every Home! 21-inch Phosphor Screen.',
    primaryColor: 0x2b2d42,
    secondaryColor: ERA_1965_PALETTE.storefronts.tvScreenGlow,
    accentColor: ERA_1965_PALETTE.architecture.renovatedEnamelAqua,
    category: 'television',
  },
]);

/**
 * Sign descriptors for neon and illuminated plastic storefront bands.
 */
export interface SignBandDescriptor {
  readonly lotIndex: number;
  readonly title: string;
  readonly subtitle: string;
  readonly bandColor: number;
  readonly textColor: number;
  readonly neonAccentColor: number;
}

export const STOREFRONT_SIGNS_1965: readonly SignBandDescriptor[] = Object.freeze([
  {
    lotIndex: 0,
    title: 'SUNNY SIDE DINER',
    subtitle: 'Steaks • Shakes • Jukebox • Open 24 Hours',
    bandColor: ERA_1965_PALETTE.architecture.googieCanopyWhite,
    textColor: ERA_1965_PALETTE.architecture.googieAccentOrange,
    neonAccentColor: ERA_1965_PALETTE.neon.dinerAmber,
  },
  {
    lotIndex: 1,
    title: 'GROOVE & SPIN RECORDS',
    subtitle: 'Latest 45s & Stereo LPs • Rock • Soul • Jazz',
    bandColor: ERA_1965_PALETTE.architecture.renovatedEnamelAqua,
    textColor: 0xffffff,
    neonAccentColor: ERA_1965_PALETTE.neon.recordsCyan,
  },
  {
    lotIndex: 2,
    title: 'MODERN TOWER PLAZA',
    subtitle: 'Offices & Professional Suites',
    bandColor: ERA_1965_PALETTE.architecture.curtainWallSteel,
    textColor: 0xffffff,
    neonAccentColor: ERA_1965_PALETTE.architecture.curtainWallGlass,
  },
  {
    lotIndex: 3,
    title: 'ELECTRO-VISION HI-FI & TV',
    subtitle: 'Color TV Consoles • Stereo Phonographs • Radios',
    bandColor: ERA_1965_PALETTE.architecture.renovatedEnamelYellow,
    textColor: 0x111111,
    neonAccentColor: ERA_1965_PALETTE.neon.tvElectricBlue,
  },
  {
    lotIndex: 4,
    title: 'APEX TOBACCONIST & PIPES',
    subtitle: 'Imported Cigars • Fine Briar Pipes • Tobaccos',
    bandColor: ERA_1965_PALETTE.storefronts.tobacconistTeak,
    textColor: 0xffd700,
    neonAccentColor: ERA_1965_PALETTE.neon.openPink,
  },
  {
    lotIndex: 5,
    title: 'SPEEDY WASH LAUNDROMAT',
    subtitle: 'All New Front-Loading Washers • 20 Min Dry',
    bandColor: ERA_1965_PALETTE.architecture.renovatedEnamelMint,
    textColor: 0x1d3557,
    neonAccentColor: ERA_1965_PALETTE.neon.laundryBrightGreen,
  },
]);

/**
 * Creates a plastic/enamel sign band with 3D fascia plate, border trim, and neon text bar.
 */
export function createSignBand(
  width: number,
  height: number,
  descriptor: SignBandDescriptor,
): Object3D {
  const group = new Object3D();

  // Background plastic fascia band
  const fascia = createBox(
    width,
    height,
    0.25,
    descriptor.bandColor,
    0,
    0,
    0,
  );
  group.add(fascia);

  // Aluminum upper & lower trim extrusions
  const topTrim = createBox(
    width + 0.1,
    0.1,
    0.3,
    ERA_1965_PALETTE.architecture.chromeTrim,
    0,
    height / 2 + 0.05,
    0,
  );
  const btmTrim = createBox(
    width + 0.1,
    0.1,
    0.3,
    ERA_1965_PALETTE.architecture.chromeTrim,
    0,
    -height / 2 - 0.05,
    0,
  );
  group.add(topTrim, btmTrim);

  // Raised 3D block lettering bar (emulating acrylic illuminated letters)
  const letterBar = createBox(
    width * 0.85,
    height * 0.45,
    0.1,
    descriptor.textColor,
    0,
    0.05,
    0.15,
  );
  group.add(letterBar);

  // Glowing neon accent strip
  const neonStrip = createBox(
    width * 0.9,
    0.08,
    0.08,
    descriptor.neonAccentColor,
    0,
    -height * 0.3,
    0.18,
  );
  group.add(neonStrip);

  return group;
}
