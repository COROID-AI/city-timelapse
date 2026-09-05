import * as THREE from "three";
import type { EraId } from "../eras";
import { ERA_IDS } from "../eras";
import type { EraData } from "../era-data";
import { getEraData } from "../era-data";
import type { SceneModule } from "./registry";
import type { CityBlockLayoutData } from "./city-block";
import { buildBlockLayoutData } from "./city-block";

/**
 * StorefrontAdverts — the street-level advertising & storefront layer.
 *
 * Consumes the storefronts/advertising sections of `EraData` (src/era-data.ts)
 * and the canonical plot slots from the CityBlock base layout. Every period
 * element snaps into a facade anchor derived from a plot slot:
 *
 *   - a ground-floor storefront band (glazing + sign + awning) on every plot's
 *     street-facing edge;
 *   - an upper-wall ad tier (painted wall ad / neon / graffiti + backlit /
 *     vinyl banner / projection / holo) on the same facade;
 *   - a rooftop billboard on the four corner plots;
 *   - era props next to the door (1945 war-effort posters, 1985 arcade
 *     marquee, 2025 EV charger + e-scooter rack, 2055 beacon).
 *
 * Era change (`onEraChange` / `setEra`) rebuilds every surface: textures are
 * canvas-generated per era tech (paint, neon tube, backlit box, LED/LCD,
 * vinyl, hologram) — never external assets — and digital-era surfaces animate
 * in `update()`: 2005 LCD shop windows scroll a marquee, 2025/2055
 * billboards + screens cycle or shimmer in real time.
 *
 * Headless/resilient: when a 2d context is unavailable (unit tests / CI) the
 * texture is skipped and the surface falls back to a flat era color; the
 * anchoring and digital-state machinery still run so tests stay meaningful.
 */

export type FacadeFacing = "north" | "south";

/** Street-facing facade anchor derived from one plot slot. */
export interface FacadeAnchor {
  id: string;
  plotId: string;
  row: number;
  col: number;
  /** Facade plane center (world X). */
  x: number;
  /** Facade plane center (world Z), offset slightly outside the slab face. */
  z: number;
  /** Cardinal direction the facade normal points toward the street. */
  facing: FacadeFacing;
  /** Usable storefront width along the facade (facingScaled plot width). */
  width: number;
}

/** Rooftop billboard anchor — only corner plots. */
export interface BillboardAnchor {
  id: string;
  plotId: string;
  x: number;
  z: number;
  width: number;
  height: number;
  /** Y rotation so the panel faces the street. */
  rotY: number;
}

export interface StorefrontAdLayout {
  facades: readonly FacadeAnchor[];
  billboards: readonly BillboardAnchor[];
}

/** World dimensions — public so tests can bound the anchoring assertions. */
export const STOREFRONT_BAND_HEIGHT = 3.4;
export const SIGN_BAND_HEIGHT = 1.5;
export const WALL_AD_HEIGHT = 3.0;
export const AWNING_PROTRUSION = 1.35;
export const BILLBOARD_WIDTH = 9.6;
export const BILLBOARD_HEIGHT = 5.2;

/** Offset of the facade plane outside the slab face (avoids z-fighting). */
const FACADE_OUTSET = 0.06;

/**
 * Build street-facing facade anchors for every plot plus rooftop billboard
 * anchors for the four corner plots. Pure and three-free so the unit test can
 * assert plot anchoring directly.
 */
export function buildStorefrontAdLayout(
  layout: CityBlockLayoutData,
): StorefrontAdLayout {
  const facades: FacadeAnchor[] = [];
  const billboards: BillboardAnchor[] = [];

  for (const plot of layout.plots) {
    const north = plot.row === 0;
    const facing: FacadeFacing = north ? "north" : "south";
    const edgeZ = north ? plot.z - plot.depth / 2 : plot.z + plot.depth / 2;
    // Outset toward the street keeps sign planes off the placeholder slab face.
    const outward = north ? -1 : 1;
    const z = edgeZ + outward * FACADE_OUTSET;
    const width = plot.width * plot.facingScale;
    facades.push({
      id: `facade-${plot.id}`,
      plotId: plot.id,
      row: plot.row,
      col: plot.col,
      x: plot.x,
      z,
      facing,
      width,
    });

    const isCorner = plot.col === 0 || plot.col === layout.plotsPerRow - 1;
    if (isCorner) {
      billboards.push({
        id: `billboard-${plot.id}`,
        plotId: plot.id,
        x: plot.x,
        // Slightly inside the slab so the panel reads as building-mounted.
        z: z - outward * FACADE_OUTSET * 3,
        width: BILLBOARD_WIDTH,
        height: BILLBOARD_HEIGHT,
        rotY: north ? Math.PI : 0,
      });
    }
  }

  return { facades, billboards };
}

type AdTextureStyle = "painted" | "neon" | "backlit" | "led" | "holo" | "vinyl";

export interface AdTextureOptions {
  width: number;
  height: number;
  headline: string;
  sub?: string;
  fg: number;
  bg: number;
  accent: number;
  style: AdTextureStyle;
  /** Animation phase: led scroll offset (px) / holo shimmer band x. */
  phase?: number;
}

const FONT_SERIF = '"Georgia", "Times New Roman", serif';
const FONT_SANS = '"Arial", "Helvetica", sans-serif';

function cssColor(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

const HOLD_TEXT_OFFSET = 340;

/**
 * Paint an ad into a canvas. The same painter backs static textures and the
 * live digital surfaces so animated styles share one code path.
 */
export function paintAdCanvas(
  canvas: HTMLCanvasElement,
  options: AdTextureOptions,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height, headline, sub, fg, bg, accent, style } = options;
  const phase = options.phase ?? 0;
  const font = style === "painted" ? FONT_SERIF : FONT_SANS;
  const headlineSize = Math.max(14, Math.floor(height * 0.42));
  const subSize = Math.max(9, Math.floor(headlineSize * 0.42));
  const shiftX = style === "led" ? -(phase % (width + HOLD_TEXT_OFFSET)) : 0;

  ctx.fillStyle = cssColor(bg);
  ctx.fillRect(0, 0, width, height);

  if (style === "painted") {
    // Weathered hand-painted boarding.
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, (i * height) / 12, width, 1.5);
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${headlineSize}px ${font}`;
    ctx.fillStyle = cssColor(fg);
    ctx.fillText(headline, width / 2 + shiftX * 0.3, height * 0.42);
    if (sub) {
      ctx.font = `${subSize}px ${font}`;
      ctx.fillStyle = cssColor(accent);
      ctx.fillText(sub, width / 2 + shiftX * 0.3, height * 0.78);
    }
    // Paint chips / weathering specks.
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let i = 0; i < 8; i++) {
      ctx.fillRect((i * 137) % width, (i * 53) % height, 6, 3);
    }
  } else if (style === "neon") {
    // Dark plate + glowing tube lettering.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${headlineSize}px ${font}`;
    ctx.shadowColor = cssColor(accent);
    ctx.shadowBlur = 16;
    ctx.fillStyle = cssColor(fg);
    ctx.fillText(headline, width / 2, height * 0.46);
    ctx.shadowBlur = 0;
    if (sub) {
      ctx.font = `${subSize}px ${font}`;
      ctx.fillStyle = cssColor(accent);
      ctx.fillText(sub, width / 2, height * 0.82);
    }
    // Tube rows along the bottom edge.
    ctx.fillStyle = cssColor(accent);
    for (let x = 4; x < width; x += 22) {
      ctx.fillRect(x, height * 0.92, 10, 1.5);
    }
  } else if (style === "backlit") {
    // Bright plastic sign box: gradient wash + heavy letters.
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, cssColor(accent));
    grad.addColorStop(1, cssColor(fg));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${headlineSize}px ${font}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(headline, width / 2, height * 0.46);
    if (sub) {
      ctx.font = `bold ${subSize}px ${font}`;
      ctx.fillStyle = cssColor(bg);
      ctx.fillText(sub, width / 2, height * 0.82);
    }
  } else if (style === "led") {
    // Black LCD/LED screen with glowing sans text, horizontal scroll, pixel rows.
    ctx.fillStyle = "#05070c";
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${headlineSize}px ${font}`;
    ctx.shadowColor = cssColor(accent);
    ctx.shadowBlur = 10;
    ctx.fillStyle = cssColor(fg);
    // Draw twice for a seamless horizontal marquee.
    ctx.fillText(headline, width / 2 + shiftX, height * 0.44);
    ctx.fillText(
      headline,
      width / 2 + shiftX + width + HOLD_TEXT_OFFSET,
      height * 0.44,
    );
    ctx.shadowBlur = 0;
    if (sub) {
      ctx.font = `${subSize}px ${font}`;
      ctx.fillStyle = cssColor(accent);
      ctx.fillText(sub, width / 2, height * 0.82);
    }
    for (let y = 2; y < height; y += 6) {
      ctx.fillStyle = "rgba(180,230,255,0.10)";
      ctx.fillRect(0, y, width, 1);
    }
  } else if (style === "holo") {
    // Teal/cyan projection surface + shimmer band.
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, cssColor(bg));
    grad.addColorStop(1, cssColor(accent));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${headlineSize}px ${font}`;
    ctx.shadowColor = cssColor(fg);
    ctx.shadowBlur = 18;
    ctx.fillStyle = cssColor(fg);
    ctx.fillText(headline, width / 2, height * 0.44);
    ctx.shadowBlur = 0;
    if (sub) {
      ctx.font = `${subSize}px ${font}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(sub, width / 2, height * 0.8);
    }
    const holoOffset = ((phase * 30) % (width + 80)) - 40;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(holoOffset, 0, 40, height);
    ctx.fillRect(holoOffset + width + 80, 0, 40, height);
  } else {
    // vinyl: white banner, brand lettering, colored top/bottom strips.
    ctx.fillStyle = "#f4f3ef";
    ctx.fillRect(0, 0, width, height);
    const strip = Math.max(5, Math.floor(height * 0.08));
    ctx.fillStyle = cssColor(accent);
    ctx.fillRect(0, 0, width, strip);
    ctx.fillRect(0, height - strip, width, strip);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${headlineSize}px ${font}`;
    ctx.fillStyle = cssColor(fg);
    ctx.fillText(headline, width / 2, height * 0.46);
    if (sub) {
      ctx.font = `bold ${subSize}px ${font}`;
      ctx.fillStyle = cssColor(accent);
      ctx.fillText(sub, width / 2, height * 0.8);
    }
  }
}

/**
 * Render an ad as a CanvasTexture. Returns a texture, or null when no 2d
 * context exists so the caller can fall back to a flat era color.
 */
export function renderAdTexture(
  options: AdTextureOptions,
): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  paintAdCanvas(canvas, options);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = `Ad texture ${options.style} ${options.headline}`;
  return texture;
}

// --------------------------------------------------------------------------
// Era copy — shop names, upper-wall ad copy, posters, and digital cycles.
// --------------------------------------------------------------------------

const ERA_SHOPS: Record<EraId, readonly string[]> = {
  "1945": [
    "BROKER & SONS",
    "CORNER DRUG",
    "STARLIGHT RADIO",
    "MAIN ST. DINER",
    "VICTORY GARDENS",
    "HARBOR TRIMS",
    "FLAG & BANK",
    "SINER STYLES",
  ],
  "1965": [
    "MOTORAMA",
    "GOLDEN DINER",
    "TRANSISTOR EMPORIUM",
    "SODA SHOP",
    "SUNSET RECORDS",
    "CHROME GARAGE",
    "SWELL SHOES",
    "BAMBOO TWIN CINEMA",
  ],
  "1985": [
    "VIDEO VAULT",
    "ARCADE 84",
    "PIXEL PALACE",
    "ROLLER DISCO",
    "NEON NIGHT",
    "WAVE BAND",
    "CINEMA 3",
    "ARCADE ZONE",
  ],
  "2005": [
    "CELLHOUSE",
    "MEGAMART",
    "COFFEE NOW",
    "WIRELESS WORLD",
    "CINEPLEX 8",
    "BOOKWARD",
    "SMOOTH DAY SPA",
    "TECH GADGETS",
  ],
  "2025": [
    "FLAT COFFEE",
    "NEXUS CAFÉ",
    "VAPORWAVE",
    "ECO GARDEN",
    "OCULA",
    "SOAR BURST",
    "LIVE HEALTH",
    "DRIFT SALA",
  ],
  "2055": [
    "NANO NUDGE",
    "RIFT LOUNGE",
    "GRAVITY CAFÉ",
    "HELIO DEPOT",
    "LUNA TAXI",
    "DATA BLOOM",
    "OPTA STUDIO",
    "RIN MART",
  ],
};

interface WallAdSpec {
  headline: string;
  sub?: string;
}

const ERA_WALL_ADS: Record<EraId, WallAdSpec> = {
  "1945": { headline: "WAR BONDS", sub: "BUY THEM TODAY" },
  "1965": { headline: "DRINK COLD", sub: "REFRESHING!" },
  "1985": { headline: "PLAY NOW", sub: "10 CENTS A GAME" },
  "2005": { headline: "GRAND OPENING", sub: "BUY 1 GET 1" },
  "2025": { headline: "GO ELECTRIC", sub: "RIDE SHARE ANYTIME" },
  "2055": { headline: "ASCEND", sub: "MARS COLONY — BOOK NOW" },
};

interface PosterSpec {
  text: string;
  color: number;
}

const ERA_POSTERS_1945: readonly PosterSpec[] = [
  { text: "VICTORY GARDENS", color: 0x4e6e58 },
  { text: "SAVE GAS", color: 0x3a3a33 },
  { text: "JOIN UP", color: 0x8a5a42 },
];

interface AdItem {
  headline: string;
  sub?: string;
  fg: number;
  bg: number;
  accent: number;
}

const DIGITAL_EXTRAS: Record<
  EraId,
  readonly { headline: string; sub: string }[]
> = {
  "2005": [
    { headline: "NOW SERVING WI-FI", sub: "FRESH & FAST" },
    { headline: "NEXUS", sub: "MORE: LATER" },
  ],
  "2025": [
    { headline: "LIVE FREE", sub: "CITY EVENTS HERE" },
    { headline: "EV RIDE", sub: "ZERO EMISSIONS" },
  ],
  "2055": [
    { headline: "NANO NUDGE 5", sub: "HOLO-MATICS" },
    { headline: "LUNA TAXI", sub: "DESCEND NOW" },
  ],
  "1945": [],
  "1965": [],
  "1985": [],
};

function digitalItemsForEra(
  eraId: EraId,
  primary: string,
  primarySub?: string,
  palette: readonly number[] = [],
): AdItem[] {
  const fg = palette.length > 2 ? (palette[2] ?? 0xffffff) : 0xffffff;
  const bg = palette[0] ?? 0x0a0a0c;
  const accent = palette.length > 1 ? (palette[1] ?? 0x3fd0ff) : 0x3fd0ff;
  const items: AdItem[] = [
    { headline: primary, sub: primarySub, fg, bg, accent },
  ];
  for (const extra of DIGITAL_EXTRAS[eraId] ?? []) {
    items.push({ headline: extra.headline, sub: extra.sub, fg, bg, accent });
  }
  return items;
}

// --------------------------------------------------------------------------
// Era tech mappings.
// --------------------------------------------------------------------------

type SignTech = "painted" | "neon" | "backlit" | "led" | "holo";

function signTechForStyle(style: string): SignTech {
  switch (style) {
    case "painted":
      return "painted";
    case "neon_tube":
      return "neon";
    case "neon_box":
      return "backlit";
    case "led":
    case "led_screen":
      return "led";
    case "hologram":
      return "holo";
    default:
      return "led";
  }
}

type AwningKind = "canvas" | "metal" | "plastic" | "glass" | "holo";

function awningKindForStyle(style: string): AwningKind {
  switch (style) {
    case "metal":
      return "metal";
    case "plastic":
      return "plastic";
    case "glass":
      return "glass";
    case "holo":
      return "holo";
    case "canvas":
    default:
      return "canvas";
  }
}

function billboardTechForStyle(style: string): SignTech {
  switch (style) {
    case "painted":
      return "painted";
    case "neon":
    case "sodium_lit":
      return "neon";
    case "hologram":
      return "holo";
    case "led":
    default:
      return "led";
  }
}

function wallAdStyleForEra(id: EraId): AdTextureStyle {
  if (id === "1945") return "painted";
  if (id === "1965" || id === "1985") return "neon";
  if (id === "2005") return "vinyl";
  if (id === "2055") return "holo";
  return "led";
}

function digitalModeForEra(
  id: EraId,
  surface: "billboard" | "sign" | "wall",
): "cycle" | "scroll" | "holo" {
  if (id === "2005") return surface === "sign" ? "scroll" : "cycle";
  if (id === "2025") return "cycle";
  if (id === "2055") return "holo";
  return "cycle";
}

// --------------------------------------------------------------------------
// Stats & digital surface state.
// --------------------------------------------------------------------------

export interface StorefrontStat {
  plotId: string;
  signStyle: string;
  awningStyle: string;
  headline: string;
}

export interface BillboardStat {
  plotId: string;
  style: string;
  headline: string;
  subHeadline: string;
}

export interface DigitalSurfaceState {
  plotId: string;
  kind: "storefront" | "billboard";
  mode: "scroll" | "cycle" | "holo";
  index: number;
  rollOffset: number;
}

export interface StorefrontAdvertStats {
  preparedEra: EraId | null;
  storefronts: StorefrontStat[];
  billboards: BillboardStat[];
  digitalCount: number;
  digitalStates: DigitalSurfaceState[];
}

interface DigitalSurface {
  state: DigitalSurfaceState;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  items: AdItem[];
  style: AdTextureStyle;
  accumulator: number;
}

const CYCLE_INTERVAL_SECONDS = 2.4;

// --------------------------------------------------------------------------
// The scene module.
// --------------------------------------------------------------------------

export class StorefrontAdverts implements SceneModule {
  readonly group: THREE.Group;
  readonly layout: CityBlockLayoutData;
  readonly adLayout: StorefrontAdLayout;

  /** Increments on every digital-surface repaint (animation evidence). */
  digitalTick = 0;
  private preparedEra: EraId | null = null;
  private readonly plotGroups = new Map<string, THREE.Group>();
  private readonly billboardGroups = new Map<string, THREE.Group>();
  private readonly digitalSurfaces: DigitalSurface[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private storefronts: StorefrontStat[] = [];
  private billboardStats: BillboardStat[] = [];
  private sharedPlate: THREE.BufferGeometry | null = null;
  private sharedBox: THREE.BufferGeometry | null = null;
  private sharedSphere: THREE.BufferGeometry | null = null;
  private sharedCylinder: THREE.BufferGeometry | null = null;

  constructor(layout: CityBlockLayoutData = buildBlockLayoutData()) {
    this.layout = layout;
    this.adLayout = buildStorefrontAdLayout(layout);
    this.group = new THREE.Group();
    this.group.name = "StorefrontAdverts";
    this.setEra("1945");
  }

  get stats(): StorefrontAdvertStats {
    return {
      preparedEra: this.preparedEra,
      storefronts: this.storefronts,
      billboards: this.billboardStats,
      digitalCount: this.digitalSurfaces.length,
      digitalStates: this.digitalSurfaces.map((surface) => ({
        ...surface.state,
      })),
    };
  }

  /** Rebuild every surface for the era (morphs the whole street-level tier). */
  setEra(eraId: EraId): void {
    const data = getEraData(eraId);
    this.clearContent();
    this.preparedEra = eraId;
    this.shareGeometries();

    const shops = ERA_SHOPS[eraId] ?? ERA_SHOPS["1945"];
    const wallAd = ERA_WALL_ADS[eraId] ?? ERA_WALL_ADS["1945"];

    for (const anchor of this.adLayout.facades) {
      const plot = this.layout.plots.find((p) => p.id === anchor.plotId);
      if (!plot) continue;
      const index = this.layout.plots.findIndex((p) => p.id === plot.id);
      const shopName =
        shops[plot.row * this.layout.plotsPerRow + plot.col] ??
        shops[0] ??
        "SHOP";
      const group = this.buildFacadeGroup(
        anchor,
        index,
        data,
        shopName,
        wallAd,
      );
      this.plotGroups.set(anchor.plotId, group);
      this.group.add(group);
    }

    for (const anchor of this.adLayout.billboards) {
      const plot = this.layout.plots.find((p) => p.id === anchor.plotId);
      const index = plot
        ? this.layout.plots.findIndex((p) => p.id === plot.id)
        : 0;
      const group = this.buildBillboardGroup(anchor, index, data);
      this.billboardGroups.set(anchor.id, group);
      this.group.add(group);
    }
  }

  update(deltaSeconds: number): void {
    for (const surface of this.digitalSurfaces) {
      const delta = Math.max(0, deltaSeconds);
      surface.accumulator += delta;
      const mode = surface.state.mode;
      if (mode === "scroll") {
        surface.state.rollOffset += delta * 34;
        if (surface.accumulator > 0.09) {
          surface.accumulator = 0;
          this.digitalTick++;
          this.paintDigital(surface);
        }
      } else if (mode === "holo") {
        if (surface.accumulator > 0.12) {
          surface.accumulator = 0;
          surface.state.rollOffset += 1;
          this.digitalTick++;
          this.paintDigital(surface);
        }
      } else if (surface.accumulator >= CYCLE_INTERVAL_SECONDS) {
        surface.accumulator = 0;
        if (surface.items.length > 1) {
          surface.state.index =
            (surface.state.index + 1) % surface.items.length;
        }
        this.digitalTick++;
        this.paintDigital(surface);
      }
    }
  }

  /** Era-store event hook: shell.setEra(index) → rebuild this layer. */
  onEraChange(eraIndex: number): void {
    const era = ERA_IDS[eraIndex];
    if (era) this.setEra(era);
  }

  dispose(): void {
    this.clearContent();
    this.group.clear();
  }

  private shareGeometries(): void {
    const plate = new THREE.PlaneGeometry(1, 1);
    plate.name = "Storefront sign/shade plate";
    const box = new THREE.BoxGeometry(1, 1, 1);
    box.name = "Storefront facade box";
    const sphere = new THREE.SphereGeometry(0.5, 8, 6);
    sphere.name = "Storefront bulb sphere";
    const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    cylinder.name = "Storefront post cylinder";
    this.geometries.push(plate, box, sphere, cylinder);
    this.sharedPlate = plate;
    this.sharedBox = box;
    this.sharedSphere = sphere;
    this.sharedCylinder = cylinder;
  }

  private shardGeometriesRef(): {
    plate: THREE.BufferGeometry;
    box: THREE.BufferGeometry;
    sphere: THREE.BufferGeometry;
    cylinder: THREE.BufferGeometry;
  } {
    const plate = this.sharedPlate ?? new THREE.PlaneGeometry(1, 1);
    const box = this.sharedBox ?? new THREE.BoxGeometry(1, 1, 1);
    const sphere = this.sharedSphere ?? new THREE.SphereGeometry(0.5, 8, 6);
    const cylinder =
      this.sharedCylinder ?? new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    return { plate, box, sphere, cylinder };
  }

  private attachUserPlotData(object: THREE.Object3D, plotId: string): void {
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).userData.plotId = plotId;
      }
    });
    if ((object as THREE.Mesh).isMesh) {
      object.userData.plotId = plotId;
    }
  }

  private buildFacadeGroup(
    anchor: FacadeAnchor,
    plotIndex: number,
    data: EraData,
    shopName: string,
    wallAd: WallAdSpec,
  ): THREE.Group {
    const facade = new THREE.Group();
    facade.name = `Storefront facade ${anchor.plotId}`;
    facade.userData.storefront = {
      plotId: anchor.plotId,
      era: data.era,
      signStyle: data.storefronts.signStyle,
      awningStyle: data.storefronts.awningStyle,
      headline: shopName,
    };

    const north = anchor.facing === "north";
    const shard = this.shardGeometriesRef();
    const height = THREE.MathUtils.lerp(
      data.architecture.heightRange[0],
      data.architecture.heightRange[1],
      plotIndex / Math.max(1, this.layout.plots.length - 1),
    );

    // Ground-floor glazing.
    const windowPaneCount = THREE.MathUtils.clamp(
      Math.ceil(data.storefronts.windowDensity * 6),
      2,
      6,
    );
    const paneWidth = anchor.width / windowPaneCount - 0.22;
    const paneHeight = STOREFRONT_BAND_HEIGHT * 0.82;
    const warm = THREE.MathUtils.lerp(
      0xfff2d8,
      0x50d0ff,
      1 - data.storefronts.glassWarmth,
    );
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x14161c,
      roughness: 0.25,
      metalness: 0.55,
      emissive: warm,
      emissiveIntensity: 0.25 + data.storefronts.glassWarmth * 0.55,
    });
    glassMaterial.name = `Storefront window ${data.era}`;
    this.materials.push(glassMaterial);

    for (let i = 0; i < windowPaneCount; i++) {
      const pane = new THREE.Mesh(shard.plate, glassMaterial);
      pane.scale.set(paneWidth, paneHeight, 1);
      const x =
        anchor.x - anchor.width / 2 + paneWidth / 2 + i * (paneWidth + 0.22);
      pane.position.set(x, STOREFRONT_BAND_HEIGHT * 0.42, anchor.z);
      pane.userData.plotId = anchor.plotId;
      facade.add(pane);

      // 2005 LCD shop windows: the center pane is a live scrolling screen.
      if (data.era === "2005" && i === Math.floor(windowPaneCount / 2)) {
        const lcd = this.buildDigitalSurface(
          {
            plotId: anchor.plotId,
            kind: "storefront",
            mode: "scroll",
            index: 0,
            rollOffset: 0,
          },
          digitalItemsForEra(
            data.era,
            "NOW SERVING",
            "FRESH & FAST",
            data.storefronts.signColors,
          ),
          "led",
          paneWidth,
          paneHeight,
          x,
          STOREFRONT_BAND_HEIGHT * 0.42,
          anchor.z,
          north ? Math.PI : 0,
        );
        pane.visible = false;
        if (lcd) facade.add(lcd);
      }
    }

    // Street door.
    const door = new THREE.Mesh(shard.box, glassMaterial);
    door.scale.set(1.0, 1.2, 0.12);
    door.position.set(
      anchor.x + (north ? -0.5 : 0.5) * (anchor.width * 0.22),
      0.6,
      anchor.z,
    );
    door.userData.plotId = anchor.plotId;
    facade.add(door);

    // Awning.
    const awning = this.buildAwning(anchor, north, data, shard);
    this.attachUserPlotData(awning, anchor.plotId);
    facade.add(awning);

    // Sign band.
    const sign = this.buildSignBand(
      anchor,
      north,
      data,
      shopName,
      height,
      shard,
    );
    this.attachUserPlotData(sign, anchor.plotId);
    facade.add(sign);

    // Upper wall ad tier.
    const wallHeight = Math.max(
      1.0,
      Math.min(
        WALL_AD_HEIGHT,
        height - STOREFRONT_BAND_HEIGHT - SIGN_BAND_HEIGHT - 0.2,
      ),
    );
    const wall = this.buildWallAd(
      anchor,
      north,
      data,
      wallAd,
      wallHeight,
      shard,
    );
    this.attachUserPlotData(wall, anchor.plotId);
    facade.add(wall);

    // Era props.
    const props = this.buildEraProps(anchor, north, data, height, shard);
    this.attachUserPlotData(props, anchor.plotId);
    facade.add(props);

    this.storefronts.push({
      plotId: anchor.plotId,
      signStyle: data.storefronts.signStyle,
      awningStyle: data.storefronts.awningStyle,
      headline: shopName,
    });

    return facade;
  }

  private buildAwning(
    anchor: FacadeAnchor,
    north: boolean,
    data: EraData,
    shard: {
      plate: THREE.BufferGeometry;
      box: THREE.BufferGeometry;
      sphere: THREE.BufferGeometry;
      cylinder: THREE.BufferGeometry;
    },
  ): THREE.Group {
    const awning = new THREE.Group();
    awning.name = "Storefront awning";
    const outward = north ? -1 : 1;
    const zStart = anchor.z;
    const zEnd = zStart + outward * AWNING_PROTRUSION;
    const y = STOREFRONT_BAND_HEIGHT - 1.1;
    const kind = awningKindForStyle(data.storefronts.awningStyle);
    const palette = data.storefronts.awningPalette;

    if (kind === "canvas") {
      const segments = 5;
      for (let s = 0; s < segments; s++) {
        const t = (s + 0.5) / segments;
        const z = THREE.MathUtils.lerp(zStart, zEnd, t);
        const strip = new THREE.Mesh(
          shard.box,
          new THREE.MeshStandardMaterial({
            color: palette[s % palette.length] ?? 0xa35f3d,
            roughness: 0.85,
            metalness: 0,
          }),
        );
        strip.scale.set(anchor.width, 0.12, AWNING_PROTRUSION / segments);
        strip.position.set(anchor.x, y - t * 0.22, z);
        strip.name = "Canvas awning strip";
        awning.add(strip);
        this.materials.push(strip.material as THREE.Material);
      }
      for (const sideSign of [-1, 1]) {
        const pole = new THREE.Mesh(
          shard.cylinder,
          new THREE.MeshStandardMaterial({ color: 0x3a3a33, roughness: 0.7 }),
        );
        pole.scale.set(0.06, STOREFRONT_BAND_HEIGHT * 0.8, 0.06);
        pole.position.set(
          anchor.x + sideSign * (anchor.width * 0.42),
          y + 0.15,
          zEnd,
        );
        awning.add(pole);
        this.materials.push(pole.material as THREE.Material);
      }
    } else if (kind === "metal") {
      const canopy = new THREE.Mesh(
        shard.box,
        new THREE.MeshStandardMaterial({
          color: palette[0] ?? 0xf2e6c9,
          roughness: 0.3,
          metalness: 0.85,
        }),
      );
      canopy.scale.set(anchor.width, 0.07, AWNING_PROTRUSION * 1.15);
      canopy.position.set(anchor.x, y + 0.1, (zStart + zEnd) / 2);
      canopy.name = "Metal canopy";
      awning.add(canopy);
      this.materials.push(canopy.material as THREE.Material);

      const trim = new THREE.Mesh(
        shard.box,
        new THREE.MeshStandardMaterial({
          color: 0xe8e0d0,
          roughness: 0.15,
          metalness: 1,
        }),
      );
      trim.scale.set(anchor.width, 0.05, 0.06);
      trim.position.set(
        anchor.x,
        y - 0.06,
        (zStart + zEnd) / 2 + outward * (AWNING_PROTRUSION * 0.58),
      );
      trim.name = "Chrome trim";
      awning.add(trim);
      this.materials.push(trim.material as THREE.Material);
    } else if (kind === "plastic") {
      const segments = 3;
      for (let s = 0; s < segments; s++) {
        const t = (s + 0.5) / segments;
        const z = THREE.MathUtils.lerp(zStart, zEnd, t);
        const strip = new THREE.Mesh(
          shard.box,
          new THREE.MeshStandardMaterial({
            color: palette[s % palette.length] ?? 0xd94f7a,
            roughness: 0.45,
            metalness: 0.15,
          }),
        );
        strip.scale.set(anchor.width, 0.1, AWNING_PROTRUSION / segments);
        strip.position.set(anchor.x, y - t * 0.12, z);
        strip.name = "Plastic awning strip";
        awning.add(strip);
        this.materials.push(strip.material as THREE.Material);
      }
    } else if (kind === "glass") {
      const canopy = new THREE.Mesh(
        shard.box,
        new THREE.MeshStandardMaterial({
          color: 0xbfe6ff,
          roughness: 0.12,
          metalness: 0.25,
          transparent: true,
          opacity: 0.55,
        }),
      );
      canopy.scale.set(anchor.width, 0.06, AWNING_PROTRUSION);
      canopy.position.set(anchor.x, y + 0.12, (zStart + zEnd) / 2);
      canopy.name = "Glass canopy";
      awning.add(canopy);
      this.materials.push(canopy.material as THREE.Material);
    } else {
      const canopy = new THREE.Mesh(
        shard.box,
        new THREE.MeshBasicMaterial({
          color: data.storefronts.awningPalette[0] ?? 0x7df9ff,
          transparent: true,
          opacity: 0.3,
          toneMapped: false,
        }),
      );
      canopy.scale.set(anchor.width, 0.05, AWNING_PROTRUSION);
      canopy.position.set(anchor.x, y + 0.12, (zStart + zEnd) / 2);
      canopy.name = "Holo canopy";
      awning.add(canopy);
      this.materials.push(canopy.material as THREE.Material);
    }

    return awning;
  }

  private buildSignBand(
    anchor: FacadeAnchor,
    north: boolean,
    data: EraData,
    shopName: string,
    height: number,
    shard: {
      plate: THREE.BufferGeometry;
      box: THREE.BufferGeometry;
      sphere: THREE.BufferGeometry;
      cylinder: THREE.BufferGeometry;
    },
  ): THREE.Group {
    const sign = new THREE.Group();
    sign.name = "Storefront sign band";
    const signY = STOREFRONT_BAND_HEIGHT + SIGN_BAND_HEIGHT / 2;
    const signWidth = anchor.width;
    const tech = signTechForStyle(data.storefronts.signStyle);
    const style: AdTextureStyle =
      tech === "painted"
        ? "painted"
        : tech === "neon"
          ? "neon"
          : tech === "backlit"
            ? "backlit"
            : tech === "holo"
              ? "holo"
              : "led";
    const rotY = north ? Math.PI : 0;
    const texture = renderAdTexture({
      width: 256,
      height: 96,
      headline: shopName,
      fg:
        tech === "painted" && data.storefronts.signColors.length > 2
          ? (data.storefronts.signColors[2] ?? 0xffffff)
          : 0xffffff,
      bg: data.storefronts.signColors[0] ?? 0x1a1a1c,
      accent:
        tech === "painted"
          ? (data.storefronts.signColors[0] ?? 0xd8c3a0)
          : (data.storefronts.signColors[1] ?? 0x3fd0ff),
      style,
    });

    if (tech === "led" || tech === "holo") {
      const digital = this.buildDigitalSurface(
        {
          plotId: anchor.plotId,
          kind: "storefront",
          mode: digitalModeForEra(data.era, "sign"),
          index: 0,
          rollOffset: 0,
        },
        digitalItemsForEra(
          data.era,
          shopName,
          undefined,
          data.storefronts.signColors,
        ),
        style,
        signWidth,
        SIGN_BAND_HEIGHT * 0.72,
        anchor.x,
        signY,
        anchor.z,
        rotY,
      );
      if (digital) sign.add(digital);
      const material = new THREE.MeshBasicMaterial({
        color: data.storefronts.signColors[0] ?? 0x1a1a1c,
        toneMapped: tech === "holo",
      });
      this.materials.push(material);
      const backPlate = new THREE.Mesh(shard.plate, material);
      backPlate.scale.set(signWidth, SIGN_BAND_HEIGHT * 0.72, 1);
      backPlate.position.set(anchor.x, signY, anchor.z);
      backPlate.rotation.y = rotY;
      backPlate.userData.plotId = anchor.plotId;
      sign.add(backPlate);
    } else {
      const material = this.fallbackMaterial(data, style, texture);
      const plate = new THREE.Mesh(shard.plate, material);
      plate.scale.set(signWidth, SIGN_BAND_HEIGHT * 0.7, 1);
      plate.position.set(anchor.x, signY, anchor.z);
      plate.rotation.y = rotY;
      sign.add(plate);
      if (tech === "backlit") {
        const boxMesh = new THREE.Mesh(
          shard.box,
          new THREE.MeshBasicMaterial({
            color: data.storefronts.signColors[0] ?? 0xff3f8e,
            toneMapped: false,
          }),
        );
        boxMesh.scale.set(signWidth, SIGN_BAND_HEIGHT * 0.8, 0.14);
        boxMesh.position.set(anchor.x, signY, anchor.z);
        sign.add(boxMesh);
        this.materials.push(boxMesh.material as THREE.Material);
      }
    }

    // Arcade marquee bulbs for 1985 neon box signage.
    if (data.era === "1985" && height >= 6) {
      const bulbMaterial = new THREE.MeshBasicMaterial({
        color: data.storefronts.signColors[1] ?? 0xffd23f,
        toneMapped: false,
      });
      this.materials.push(bulbMaterial);
      for (const sideSign of [-1, 1]) {
        const count = Math.max(3, Math.floor(signWidth / 1.2));
        for (let i = 0; i < count; i++) {
          const bulb = new THREE.Mesh(shard.sphere, bulbMaterial);
          bulb.scale.setScalar(0.07);
          const x =
            anchor.x -
            signWidth / 2 +
            0.6 +
            i * ((signWidth - 1.2) / Math.max(1, count - 1));
          bulb.position.set(
            x,
            signY + sideSign * (SIGN_BAND_HEIGHT * 0.34),
            anchor.z,
          );
          sign.add(bulb);
        }
      }
    }

    return sign;
  }

  private buildWallAd(
    anchor: FacadeAnchor,
    north: boolean,
    data: EraData,
    spec: WallAdSpec,
    height: number,
    shard: {
      plate: THREE.BufferGeometry;
      box: THREE.BufferGeometry;
      sphere: THREE.BufferGeometry;
      cylinder: THREE.BufferGeometry;
    },
  ): THREE.Group {
    const wall = new THREE.Group();
    wall.name = "Storefront upper wall ad";
    const rotY = north ? Math.PI : 0;
    const yBase = STOREFRONT_BAND_HEIGHT + SIGN_BAND_HEIGHT + height / 2;
    const style = wallAdStyleForEra(data.era);
    const palette = data.advertising.billboardPalette;
    const width = anchor.width * 0.9;

    if (data.era === "2025" || data.era === "2055") {
      // Projection-mapped storefront / hologram wall ad — live digital surface.
      const digital = this.buildDigitalSurface(
        {
          plotId: anchor.plotId,
          kind: "storefront",
          mode: digitalModeForEra(data.era, "wall"),
          index: 0,
          rollOffset: 0,
        },
        digitalItemsForEra(data.era, spec.headline, spec.sub, palette),
        style,
        width,
        height,
        anchor.x,
        yBase,
        anchor.z,
        rotY,
      );
      if (digital) wall.add(digital);
    }

    const texture = renderAdTexture({
      width: 256,
      height: 96,
      headline: spec.headline,
      sub: spec.sub,
      fg: palette.length > 1 ? (palette[1] ?? 0xffffff) : 0xffffff,
      bg: palette[0] ?? 0x3a3a33,
      accent: palette.length > 1 ? (palette[1] ?? 0xffd23f) : 0xffd23f,
      style,
    });
    const material = this.fallbackMaterial(data, style, texture);
    const plate = new THREE.Mesh(shard.plate, material);
    plate.scale.set(width, height, 1);
    plate.position.set(anchor.x, yBase, anchor.z);
    plate.rotation.y = rotY;
    plate.name = "Upper wall ad plate";
    wall.add(plate);

    // 1985 graffiti tag above the lit ad.
    if (data.era === "1985") {
      const tag = renderAdTexture({
        width: 160,
        height: 72,
        headline: "KASK",
        fg: 0xff5eaa,
        bg: 0x2a2a2e,
        accent: 0xffd23f,
        style: "led",
      });
      const tagMaterial = this.fallbackMaterial(data, "led", tag);
      const tagMesh = new THREE.Mesh(shard.plate, tagMaterial);
      tagMesh.scale.set(width * 0.28, height * 0.3, 1);
      tagMesh.position.set(
        anchor.x + (north ? -1 : 1) * (width * 0.3),
        yBase + height * 0.42,
        anchor.z,
      );
      tagMesh.rotation.y = rotY;
      tagMesh.name = "Graffiti tag";
      wall.add(tagMesh);
    }

    // 1945 war-effort posters pinned beside the facade.
    if (data.era === "1945") {
      for (let i = 0; i < ERA_POSTERS_1945.length; i++) {
        const poster = ERA_POSTERS_1945[i];
        const posterTex = renderAdTexture({
          width: 96,
          height: 128,
          headline: poster.text,
          fg: 0xf2efe4,
          bg: poster.color,
          accent: 0xd8c3a0,
          style: "painted",
        });
        const posterMaterial = this.fallbackMaterial(
          data,
          "painted",
          posterTex,
        );
        const posterMesh = new THREE.Mesh(shard.plate, posterMaterial);
        posterMesh.scale.set(0.85, 1.15, 1);
        posterMesh.position.set(
          anchor.x + (north ? -1 : 1) * (width * (0.32 + i * 0.14)),
          yBase + height * 0.45,
          anchor.z,
        );
        posterMesh.rotation.y = rotY;
        posterMesh.name = `War poster ${poster.text}`;
        wall.add(posterMesh);
      }
    }

    // 1965 chrome trim frame on the wall ad.
    if (data.era === "1965") {
      const frame = new THREE.Mesh(
        shard.box,
        new THREE.MeshStandardMaterial({
          color: 0xe8e0d0,
          roughness: 0.2,
          metalness: 1,
        }),
      );
      frame.scale.set(width + 0.2, 0.06, 0.05);
      frame.position.set(anchor.x, yBase - height / 2 - 0.05, anchor.z);
      frame.name = "Chrome wall frame";
      wall.add(frame);
      this.materials.push(frame.material as THREE.Material);
    }

    return wall;
  }

  private buildEraProps(
    anchor: FacadeAnchor,
    north: boolean,
    data: EraData,
    height: number,
    shard: {
      plate: THREE.BufferGeometry;
      box: THREE.BufferGeometry;
      sphere: THREE.BufferGeometry;
      cylinder: THREE.BufferGeometry;
    },
  ): THREE.Group {
    const props = new THREE.Group();
    props.name = "Era props";
    const outward = north ? -1 : 1;
    const z = anchor.z + outward * 0.95;

    if (data.era === "2025") {
      // EV charger pedestal with a small charging screen.
      const charger = new THREE.Mesh(
        shard.box,
        new THREE.MeshStandardMaterial({
          color: 0x35424f,
          roughness: 0.5,
          metalness: 0.4,
        }),
      );
      charger.scale.set(0.55, 1.25, 0.4);
      charger.position.set(anchor.x + anchor.width * 0.3, 0.62, z);
      charger.name = "EV charger";
      this.materials.push(charger.material as THREE.Material);
      props.add(charger);

      const chargerScreen = renderAdTexture({
        width: 64,
        height: 48,
        headline: "CHARGING",
        fg: 0x7fd0ff,
        bg: 0x0a1a22,
        accent: 0x59f0c2,
        style: "led",
      });
      const screenMaterial = this.fallbackMaterial(data, "led", chargerScreen);
      const screenMesh = new THREE.Mesh(shard.plate, screenMaterial);
      screenMesh.scale.set(0.4, 0.3, 1);
      screenMesh.position.set(
        anchor.x + anchor.width * 0.3,
        1.05,
        z + (north ? 0.22 : -0.22),
      );
      screenMesh.rotation.y = north ? Math.PI : 0;
      screenMesh.name = "EV charger screen";
      props.add(screenMesh);

      // E-scooter rack: rail bar + two parked scooters.
      const rackBar = new THREE.Mesh(
        shard.box,
        new THREE.MeshStandardMaterial({
          color: 0x9aa7b0,
          roughness: 0.4,
          metalness: 0.6,
        }),
      );
      rackBar.scale.set(2.6, 0.06, 0.06);
      rackBar.position.set(anchor.x - anchor.width * 0.32, 0.42, z);
      rackBar.name = "E-scooter rack";
      this.materials.push(rackBar.material as THREE.Material);
      props.add(rackBar);
      for (let i = 0; i < 2; i++) {
        const wheel = new THREE.Mesh(
          shard.cylinder,
          new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: 0.85 }),
        );
        wheel.scale.set(0.14, 0.14, 0.14);
        wheel.position.set(
          rackBar.position.x + 0.5 + i * 0.9,
          0.26,
          z + (north ? 0.16 : -0.16),
        );
        wheel.rotation.x = Math.PI / 2;
        wheel.name = "E-scooter wheel";
        props.add(wheel);
        this.materials.push(wheel.material as THREE.Material);
      }
    } else if (data.era === "2055") {
      // Hologram beacon beside the door.
      const post = new THREE.Mesh(
        shard.cylinder,
        new THREE.MeshBasicMaterial({ color: 0x59f0ff, toneMapped: false }),
      );
      post.scale.set(0.06, 2.6, 0.06);
      post.position.set(anchor.x - anchor.width * 0.34, 1.3, z);
      post.name = "Holo beacon light";
      this.materials.push(post.material as THREE.Material);
      props.add(post);
      const glow = new THREE.Mesh(
        shard.sphere,
        new THREE.MeshBasicMaterial({ color: 0x7df9ff, toneMapped: false }),
      );
      glow.scale.setScalar(0.22);
      glow.position.set(anchor.x - anchor.width * 0.34, 2.62, z);
      glow.name = "Holo beacon glow";
      this.materials.push(glow.material as THREE.Material);
      props.add(glow);
    }

    void height;
    return props;
  }

  private buildBillboardGroup(
    anchor: BillboardAnchor,
    plotIndex: number,
    data: EraData,
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = `Billboard ${anchor.plotId}`;
    const tech = billboardTechForStyle(data.advertising.billboardStyle);
    const style: AdTextureStyle =
      tech === "painted"
        ? "painted"
        : tech === "neon"
          ? "neon"
          : tech === "backlit"
            ? "backlit"
            : tech === "holo"
              ? "holo"
              : "led";
    const plot = this.layout.plots.find((p) => p.id === anchor.plotId);
    const height = plot
      ? THREE.MathUtils.lerp(
          data.architecture.heightRange[0],
          data.architecture.heightRange[1],
          plotIndex / Math.max(1, this.layout.plots.length - 1),
        )
      : 12;
    const y = height + 0.4;
    const rotY = anchor.rotY;
    const shard = this.shardGeometriesRef();

    // Frame legs on the slab roof (keeps every billboard plot-anchored).
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c2f38,
      roughness: 0.6,
      metalness: 0.5,
    });
    this.materials.push(frameMaterial);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(shard.box, frameMaterial);
      leg.scale.set(0.18, 1.1, 0.18);
      leg.position.set(
        anchor.x + side * (anchor.width * 0.44),
        y - anchor.height / 2 + 0.55,
        anchor.z,
      );
      leg.name = "Billboard leg";
      group.add(leg);
    }

    if (tech === "led" || tech === "holo" || tech === "neon") {
      // Digital / glow surfaces animate as content cycles (canvas-dynamic).
      const digital = this.buildDigitalSurface(
        {
          plotId: anchor.plotId,
          kind: "billboard",
          mode: digitalModeForEra(data.era, "billboard"),
          index: 0,
          rollOffset: 0,
        },
        digitalItemsForEra(
          data.era,
          data.advertising.headline,
          data.advertising.subheadline,
          data.advertising.billboardPalette,
        ),
        style,
        anchor.width,
        anchor.height,
        anchor.x,
        y,
        anchor.z,
        rotY,
      );
      if (digital) group.add(digital);
    }

    const texture = renderAdTexture({
      width: 256,
      height: 128,
      headline: data.advertising.headline,
      sub: data.advertising.subheadline,
      fg: data.advertising.billboardPalette[2] ?? 0xffffff,
      bg: data.advertising.billboardPalette[0] ?? 0x3a3a33,
      accent: data.advertising.billboardPalette[1] ?? 0xffd23f,
      style,
    });
    const material = this.fallbackMaterial(data, style, texture);
    const panel = new THREE.Mesh(shard.plate, material);
    panel.scale.set(anchor.width, anchor.height, 1);
    panel.position.set(anchor.x, y, anchor.z);
    panel.rotation.y = rotY;
    panel.name = "Billboard panel";
    panel.castShadow = false;
    group.add(panel);

    // Marquee bulbs frame for 1985 neon boards.
    if (data.era === "1985" && tech === "neon") {
      const bulbMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd23f,
        toneMapped: false,
      });
      this.materials.push(bulbMaterial);
      for (const rowSign of [-1, 1]) {
        const yEdge = y + rowSign * (anchor.height / 2 - 0.25);
        for (let i = 0; i < 9; i++) {
          const t = i / 8;
          const xEdge =
            anchor.x - anchor.width / 2 + 0.3 + t * (anchor.width - 0.6);
          const bulb = new THREE.Mesh(shard.sphere, bulbMaterial);
          bulb.scale.setScalar(0.09);
          bulb.position.set(xEdge, yEdge, anchor.z);
          group.add(bulb);
        }
      }
    }

    group.userData.billboard = {
      plotId: anchor.plotId,
      era: data.era,
      style: data.advertising.billboardStyle,
      headline: data.advertising.headline,
      subHeadline: data.advertising.subheadline,
    };
    this.billboardStats.push({
      plotId: anchor.plotId,
      style: data.advertising.billboardStyle,
      headline: data.advertising.headline,
      subHeadline: data.advertising.subheadline,
    });

    return group;
  }

  // ------------------------------------------------------------------------
  // Shared helpers
  // ------------------------------------------------------------------------

  private fallbackMaterial(
    data: EraData,
    style: AdTextureStyle,
    texture: THREE.Texture | null,
  ): THREE.Material {
    const isMatte = style === "painted" || style === "vinyl";
    const material = isMatte
      ? new THREE.MeshStandardMaterial({
          color: texture
            ? 0xffffff
            : style === "painted"
              ? (data.storefronts.signColors[0] ?? 0x8a5a42)
              : (data.advertising.billboardPalette[0] ?? 0xf4f3ef),
          map: texture ?? null,
          roughness: style === "painted" ? 0.9 : 0.55,
          metalness: 0,
        })
      : new THREE.MeshBasicMaterial({
          color: texture
            ? 0xffffff
            : (data.advertising.billboardPalette[0] ?? 0x0a0a0c),
          map: texture ?? null,
          toneMapped:
            style === "neon" ||
            style === "led" ||
            style === "holo" ||
            style === "backlit",
        });
    material.name = `Ad ${isMatte ? "standard" : "basic"} ${style} ${data.era}`;
    this.materials.push(material);
    return material;
  }

  private buildDigitalSurface(
    state: DigitalSurfaceState,
    items: AdItem[],
    style: AdTextureStyle,
    width: number,
    height: number,
    x: number,
    y: number,
    z: number,
    rotY: number,
  ): THREE.Group | null {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.name = `Digital ad ${state.kind} ${state.plotId}`;
    const material = new THREE.MeshBasicMaterial({
      color: 0x0a0a0c,
      map: texture,
      toneMapped: false,
    });
    material.name = `Digital surface ${state.kind} ${state.plotId}`;
    const plate = this.sharedPlate ?? new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(plate, material);
    mesh.scale.set(width, height, 1);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.userData.plotId = state.plotId;
    mesh.name = `Digital surface ${state.kind} ${state.plotId}`;

    this.materials.push(material);
    this.textures.push(texture);
    this.geometries.push(mesh.geometry);

    const surface: DigitalSurface = {
      state,
      canvas,
      texture,
      items,
      style,
      accumulator: 0,
    };
    this.paintDigital(surface);
    this.digitalSurfaces.push(surface);

    const group = new THREE.Group();
    group.name = `Digital ${state.kind} ${state.plotId}`;
    group.add(mesh);
    group.userData.digital = {
      plotId: state.plotId,
      kind: state.kind,
      mode: state.mode,
    };
    return group;
  }

  private paintDigital(surface: DigitalSurface): void {
    const ctx = surface.canvas.getContext("2d");
    if (!ctx) return;
    const item = surface.items[surface.state.index % surface.items.length];
    if (!item) return;
    paintAdCanvas(surface.canvas, {
      width: surface.canvas.width,
      height: surface.canvas.height,
      headline: item.headline,
      sub: item.sub,
      fg: item.fg,
      bg: item.bg,
      accent: item.accent,
      style: surface.style,
      phase: surface.state.rollOffset,
    });
    surface.texture.needsUpdate = true;
  }

  // ------------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------------

  private clearContent(): void {
    this.plotGroups.clear();
    this.billboardGroups.clear();
    this.digitalSurfaces.length = 0;
    for (const child of [...this.group.children]) {
      this.group.remove(child);
    }
    for (const texture of this.textures) texture.dispose();
    for (const material of this.materials) material.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    this.textures.length = 0;
    this.materials.length = 0;
    this.geometries.length = 0;
    this.sharedPlate = null;
    this.sharedBox = null;
    this.sharedSphere = null;
    this.sharedCylinder = null;
    this.storefronts = [];
    this.billboardStats = [];
  }
}
