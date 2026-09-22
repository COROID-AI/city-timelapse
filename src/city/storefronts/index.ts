/**
 * `StorefrontsModule` — era-evolving shopfronts and advertising for every
 * ground-floor bay of the city block.
 *
 * This is the `storefronts-api` shared interface consumed by the integration
 * owner (t-city-assembly). The module:
 *
 * - mounts shopfronts into the canonical bay-slot constants (6-unit pitch,
 *   5-unit clear width, base at y=0.15, sign band 3.2..4.2) without ever
 *   editing building files;
 * - pre-builds all five era treatments per bay (1945 hand-painted gold-leaf
 *   glass + scalloped fabric awnings + butcher-paper displays + pushcarts,
 *   1965 pastel channel letters + animated displays + poster walls, 1985 neon
 *   + backlit box signs + rooftop billboards, 2005 push-through plastic +
 *   menu boards + scrolling tickers, 2025 LED matrix + projection-mapped
 *   glass) and crossfades materials during transitions so textures are never
 *   rebuilt mid-morph (no popping);
 * - implements the `EraTransformable` contract per piece (shopfronts run in
 *   the `facade` stage, all signs/billboards/posters in `signage`) and
 *   registers every shopfront, billboard, and sign into the
 *   `EraTransformRegistry` through {@link StorefrontsModule.register};
 * - exposes pickable descriptors for callouts and documented audio hook
 *   events (`storefront:*`) whose ambience is driven by material emissive
 *   intensity and timed emitters consumed later by t-audio-sfx;
 * - keeps repeated window-display props and poster quads on the GPU as
 *   instanced batches.
 *
 * All signage art is procedural canvas (via the gfx-materials library) with
 * invented brand names — no image assets and no real trademarks.
 */

import * as THREE from 'three';
import {
  ERA_MORPH_STAGES,
  stageOffset as stageOffsetOf,
  type EraMorphStage,
  type EraTransformable,
  type EraTransformRegistry,
} from '../../era/contracts';
import { clamp01, easeInOutCubic, type EraBlend, type EraYear } from '../../era/timeline';
import {
  BAY_BASE_Y,
  BAY_CLEAR_WIDTH,
  BAY_SLOT_PITCH,
  ERA_STOREFRONT_VARIANTS,
  SIGN_BAND_MAX_Y,
  SIGN_BAND_MIN_Y,
  STOREFRONT_AUDIO_HOOKS,
  STOREFRONT_AUDIO_HOOK_LIST,
  STOREFRONT_VARIANT_YEARS,
  brandForBay,
  createBaySlots,
  taglineForBay,
  type BaySlot,
  type BaySlotOptions,
  type EmissiveDrive,
  type StorefrontAudioHook,
} from './variants';
import {
  createBaySignageArt,
  type BaySignageArt,
} from './signage';
import {
  buildAwning,
  buildBillboardFace,
  buildBillboardFrame,
  buildBladeSign,
  buildFasciaSign,
  buildKioskFace,
  buildKioskStructure,
  buildMenuBoard,
  buildNewsstandFace,
  buildNewsstandStructure,
  buildPosterWall,
  buildProjectionGlass,
  buildPushcart,
  buildShopfrontShell,
  buildTicker,
  buildTransomSign,
  buildWindowDisplay,
  frameColorFor,
  makeEraLayer,
  setLayerWeight,
  type EraLayer,
  type LayerMaterial,
  type PosterSlot,
} from './displays';

/* -------------------------------------------------------------------------- */
/* Public API types                                                            */
/* -------------------------------------------------------------------------- */

/** One storefront-originated audio hook event (documented for t-audio-sfx). */
export interface StorefrontAudioEvent {
  /** Documented hook name from {@link STOREFRONT_AUDIO_HOOKS}. */
  type: StorefrontAudioHook;
  /** Emitting piece, e.g. `bay-2` signage or `billboard-rooftop`. */
  sourceId: string;
  /** Era whose ambience produced the event. */
  era: EraYear;
  /** Strength in 0..1 (current era weight or flicker amplitude). */
  intensity: number;
  /** Module clock seconds at emission. */
  time: number;
}

/**
 * Pickable descriptor for click-to-focus callouts. Structurally compatible
 * with the navigation module's `PickableDescriptor` (`id` + `object` plus
 * optional focus framing), with extra labelling for callout providers.
 */
export interface StorefrontPickable {
  /** Stable id used in events and provider lookups. */
  id: string;
  /** Object the raycaster intersects (descendants included). */
  object: THREE.Object3D;
  /** Straight-line framing distance override for focus flights. */
  focusDistance?: number;
  /** Preferred eye height for the focus viewpoint. */
  focusHeight?: number;
  /** Human-readable label for callout headers. */
  label?: string;
}

/** Per-era treatment summary exposed for diagnostics, tests, and callouts. */
export interface StorefrontTreatmentInfo {
  fasciaSign: string;
  transomSign: string;
  bladeSign: string | null;
  awning: string;
  windowDisplay: string;
  menuBoard: boolean;
  ticker: boolean;
  projectionGlass: boolean;
  billboard: string;
  kiosk: string;
  newsstand: string;
  pushcart: boolean;
  /** Invented brand name rendered on this bay's signs. */
  brand: string;
  /** Invented tagline rendered under the brand. */
  tagline: string;
}

/** One bay's identity and era treatments. */
export interface StorefrontBayInfo {
  id: string;
  index: number;
  x: number;
  z: number;
  treatments: Record<EraYear, StorefrontTreatmentInfo>;
}

/** Per-piece crossfade diagnostics (used by staged-morph tests). */
export interface StorefrontPieceSnapshot {
  id: string;
  stage: EraMorphStage;
  from: EraYear;
  to: EraYear;
  /** Staged crossfade value in 0..1 (0 = fully `from`, 1 = fully `to`). */
  crossfade: number;
  /** Per-era layer weights currently applied to this piece. */
  weights: Partial<Record<EraYear, number>>;
}

/** Construction options for {@link createStorefrontsModule}. */
export interface StorefrontsOptions {
  /** Number of ground-floor bays along the facade (default 6). */
  bays?: number;
  /** Facade placement (origin and facing) for the bay row. */
  slot?: BaySlotOptions;
  /** Era the scene starts in (default 1945). */
  initialYear?: EraYear;
  /** Direct audio-hook listener (in addition to `onAudioEvent`). */
  onAudioEvent?: (event: StorefrontAudioEvent) => void;
}

/** The produced storefronts-api surface consumed by the integration owner. */
export interface StorefrontsModule {
  /** Root group holding every shopfront, sign, billboard, and kiosk. */
  readonly group: THREE.Group;
  /** Canonical bay slots the module mounted into. */
  readonly bays: readonly BaySlot[];
  /** Per-bay identities and per-era treatment summaries. */
  readonly bayInfo: readonly StorefrontBayInfo[];
  /** Every shopfront/billboard/sign transformable, in build order. */
  readonly transformables: readonly EraTransformable[];
  /** Pickable descriptors for click-to-focus callouts. */
  readonly pickables: readonly StorefrontPickable[];
  /** Documented audio hook names this module can emit. */
  readonly audioHooks: readonly StorefrontAudioHook[];
  /** Register every shopfront/billboard/sign; returns an unregister fn. */
  register(registry: EraTransformRegistry): () => void;
  /** Drive ambience/animation: flicker, emissive, ticker scroll, audio. */
  update(deltaSeconds: number, elapsedSeconds?: number): number;
  /** Subscribe to audio hook events; returns an unsubscribe function. */
  onAudioEvent(listener: (event: StorefrontAudioEvent) => void): () => void;
  /** Current staged crossfade snapshot of every registered piece. */
  pieceSnapshots(): StorefrontPieceSnapshot[];
  /** Raw (untimed) era weights implied by the latest dispatched blend. */
  eraWeights(): Record<EraYear, number>;
  /** Currently dominant era (highest raw weight). */
  dominantEra(): EraYear;
  /** Release geometries and materials (memoized textures survive). */
  dispose(): void;
}

/* -------------------------------------------------------------------------- */
/* Staged crossfade math                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Staged within-segment crossfade.
 *
 * The registry hands every piece the raw blend plus its stage offset. Each
 * stage owns an equal window of the segment's 0..1 fraction, so facades
 * finish their swap before signage starts (and sound finishes last), exactly
 * mirroring `stageProgress` while staying continuous at segment boundaries
 * of multi-era jumps (1945→2025 replays the staging per segment). Steady
 * states resolve correctly: interior stops dispatch fraction 0 (the `from`
 * stop era carries full weight) and the final stop dispatches fraction 1.
 */
function stagedCrossfade(blend: EraBlend, offset: number): number {
  const local = (clamp01(blend.fraction) - offset) * ERA_MORPH_STAGES.length;
  return easeInOutCubic(clamp01(local));
}

/** Deterministic hash noise for flicker/LED animation (seed, bucket). */
function hashNoise(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** Era with the highest weight; ties prefer the earlier era (deterministic). */
function dominantOf(weights: Record<EraYear, number>): EraYear {
  let best: EraYear = STOREFRONT_VARIANT_YEARS[0];
  let bestW = -1;
  for (const year of STOREFRONT_VARIANT_YEARS) {
    const w = weights[year] ?? 0;
    if (w > bestW + 1e-9) {
      bestW = w;
      best = year;
    }
  }
  return best;
}

/** Audio hook replay intervals in seconds (SIGN_SWAP is event-driven). */
const HOOK_INTERVALS: Partial<Record<StorefrontAudioHook, number>> = {
  [STOREFRONT_AUDIO_HOOKS.FLUORESCENT_HUM]: 2.5,
  [STOREFRONT_AUDIO_HOOKS.NEON_HUM]: 2.0,
  [STOREFRONT_AUDIO_HOOKS.BACKLIT_BUZZ]: 2.5,
  [STOREFRONT_AUDIO_HOOKS.LED_SCROLL]: 1.0,
  [STOREFRONT_AUDIO_HOOKS.LED_TICK]: 0.6,
};

/* -------------------------------------------------------------------------- */
/* Morph pieces                                                                */
/* -------------------------------------------------------------------------- */

interface MorphPieceOptions {
  id: string;
  stage: EraMorphStage;
  /** Era layers indexed like {@link STOREFRONT_VARIANT_YEARS}; null skips. */
  layers: (EraLayer | null)[];
  /** Materials whose color lerps between era frame colors (shell tint). */
  tintMaterials?: THREE.MeshStandardMaterial[];
  /** Called whenever this piece's dominant era flips (SIGN_SWAP audio). */
  onSwap?: (pieceId: string, era: EraYear) => void;
  /** Called with every dispatched blend so the module can track raw weights. */
  onBlend?: (blend: EraBlend) => void;
  /** Initial dominant era, set before the first dispatch. */
  initialEra: EraYear;
}

interface MorphPiece extends EraTransformable {
  readonly id: string;
  readonly stage: EraMorphStage;
  snapshot(): StorefrontPieceSnapshot;
}

function createMorphPiece(options: MorphPieceOptions): MorphPiece {
  const layerMap = new Map<EraYear, EraLayer>();
  STOREFRONT_VARIANT_YEARS.forEach((year, index) => {
    const layer = options.layers[index];
    if (layer) layerMap.set(year, layer);
  });
  const weights = Object.fromEntries(STOREFRONT_VARIANT_YEARS.map((y) => [y, 0])) as Record<
    EraYear,
    number
  >;
  const tint = options.tintMaterials ?? [];
  let from: EraYear = options.initialEra;
  let to: EraYear = options.initialEra;
  let crossfade = 0;
  let dominant = options.initialEra;

  const piece: MorphPiece = {
    id: options.id,
    stage: options.stage,
    applyEraBlend(blend: EraBlend, offsetArg: number, progress: number): void {
      const offset = Number.isFinite(offsetArg) ? offsetArg : stageOffsetOf(options.stage);
      const e = stagedCrossfade(blend, offset);
      const flare = 1 + 0.5 * Math.sin(Math.PI * clamp01(progress));
      from = blend.from;
      to = blend.to;
      crossfade = e;
      for (const [year, layer] of layerMap) {
        const w = year === blend.from ? 1 - e : year === blend.to ? e : 0;
        weights[year] = w;
        setLayerWeight(layer, w, flare);
      }
      if (tint.length > 0) {
        const cFrom = frameColorFor(blend.from);
        const cTo = frameColorFor(blend.to);
        for (const material of tint) material.color.lerpColors(cFrom, cTo, e);
      }
      const nextDominant = dominantOf(weights);
      if (nextDominant !== dominant) {
        dominant = nextDominant;
        options.onSwap?.(options.id, nextDominant);
      }
      options.onBlend?.(blend);
    },
    snapshot(): StorefrontPieceSnapshot {
      return {
        id: options.id,
        stage: options.stage,
        from,
        to,
        crossfade,
        weights: { ...weights },
      };
    },
  };
  return piece;
}

/* -------------------------------------------------------------------------- */
/* Animated ambience bookkeeping                                               */
/* -------------------------------------------------------------------------- */

interface EmissiveAnim {
  layer: EraLayer;
  entry: LayerMaterial;
  kind: EmissiveDrive;
  seed: number;
  sourceId: string;
  lastFlicker: number;
}

interface TickerAnim {
  layer: EraLayer;
  texture: THREE.CanvasTexture;
  speed: number;
}

/* -------------------------------------------------------------------------- */
/* Module factory                                                              */
/* -------------------------------------------------------------------------- */

/** Sidewalk z offset for street furniture in front of the bays. */
const SIDEWALK_Z = 2.4;
/** Poster quad world y on the pier faces. */
const POSTER_Y = 1.75;
/** Z stagger per era layer; keeps coplanar era faces from z-fighting. */
const ERA_Z_STAGGER = 0.004;

/**
 * Build the storefronts module for one ground-floor facade row.
 *
 * All five era treatments are constructed up front (memoized procedural
 * textures shared where copy allows); transitions only crossfade material
 * opacity/emissive, so era swaps never allocate GPU textures mid-morph.
 */
export function createStorefrontsModule(options: StorefrontsOptions = {}): StorefrontsModule {
  const bayCount = Math.max(1, Math.floor(options.bays ?? 6));
  const slots = createBaySlots(bayCount, options.slot ?? {});
  const initialYear: EraYear = options.initialYear ?? 1945;
  const years = STOREFRONT_VARIANT_YEARS;
  const initialIndex = years.indexOf(initialYear);
  const nextYear = years[Math.min(initialIndex + 1, years.length - 1)];

  const group = new THREE.Group();
  group.name = 'storefronts';

  const pieces: MorphPiece[] = [];
  const emissiveAnims: EmissiveAnim[] = [];
  const tickerAnims: TickerAnim[] = [];
  const pickables: StorefrontPickable[] = [];
  const bayInfo: StorefrontBayInfo[] = [];
  const listeners = new Set<(event: StorefrontAudioEvent) => void>();
  const hookLastEmit = new Map<StorefrontAudioHook, number>();
  const rawWeights = Object.fromEntries(years.map((y) => [y, y === initialYear ? 1 : 0])) as Record<
    EraYear,
    number
  >;

  let clock = 0;
  let disposed = false;
  if (options.onAudioEvent) listeners.add(options.onAudioEvent);

  const emit = (event: StorefrontAudioEvent): void => {
    for (const listener of listeners) listener(event);
  };

  const rememberBlend = (blend: EraBlend): void => {
    const f = clamp01(blend.fraction);
    for (const year of years) rawWeights[year] = 0;
    rawWeights[blend.from] = 1 - f;
    rawWeights[blend.to] = f;
  };

  const registerEmissiveAnims = (
    layer: EraLayer,
    kind: EmissiveDrive,
    seedBase: number,
    sourceId: string,
  ): void => {
    layer.materials.forEach((entry, index) => {
      if (entry.baseEmissive <= 0.001) return;
      emissiveAnims.push({
        layer,
        entry,
        kind,
        seed: seedBase + index,
        sourceId,
        lastFlicker: -1,
      });
    });
  };

  /* ---------------------------------------------------------------------- */
  /* Shared module-level art (bayIndex 0 → shared with bay 0 via memoization) */
  /* ---------------------------------------------------------------------- */
  const sharedArt = new Map<EraYear, BaySignageArt>();
  for (const year of years) {
    sharedArt.set(year, createBaySignageArt({ variant: ERA_STOREFRONT_VARIANTS[year], bayIndex: 0 }));
  }

  /* ---------------------------------------------------------------------- */
  /* Per-bay shopfronts                                                      */
  /* ---------------------------------------------------------------------- */
  slots.forEach((slot) => {
    const bayGroup = new THREE.Group();
    bayGroup.name = `shopfront-${slot.id}`;
    bayGroup.position.set(slot.x, 0, slot.z);
    bayGroup.rotation.y = slot.rotationY;
    group.add(bayGroup);

    // Era-stable shell; its tint lerps between era frame colors while morphing.
    const shell = buildShopfrontShell();
    bayGroup.add(shell.group);

    // --- facade-stage piece: shell + awnings + window displays + pushcart ---
    const facadeLayers: (EraLayer | null)[] = [];
    // --- signage-stage piece: fascia/transom/blade/ticker/menu/projection ---
    const signageLayers: (EraLayer | null)[] = [];

    const treatments: Record<EraYear, StorefrontTreatmentInfo> = {} as Record<
      EraYear,
      StorefrontTreatmentInfo
    >;

    years.forEach((year, eraIndex) => {
      const variant = ERA_STOREFRONT_VARIANTS[year];
      const art = createBaySignageArt({ variant, bayIndex: slot.index });
      treatments[year] = {
        fasciaSign: variant.fasciaSign,
        transomSign: variant.transomSign,
        bladeSign: variant.bladeSign,
        awning: variant.awning,
        windowDisplay: variant.windowDisplay,
        menuBoard: variant.menuBoard,
        ticker: variant.ticker,
        projectionGlass: variant.projectionGlass,
        billboard: variant.billboard,
        kiosk: variant.kiosk,
        newsstand: variant.newsstand,
        pushcart: variant.pushcart,
        brand: brandForBay(variant, slot.index),
        tagline: taglineForBay(variant, slot.index),
      };

      // Facade layer group.
      const facadeGroup = new THREE.Group();
      const awning = buildAwning(variant);
      if (awning) facadeGroup.add(awning);
      facadeGroup.add(buildWindowDisplay(art, variant, slot.index));
      if (variant.pushcart && slot.index % 3 === 0) {
        const cart = buildPushcart(variant);
        if (cart) {
          cart.position.set(-0.9, BAY_BASE_Y, SIDEWALK_Z);
          facadeGroup.add(cart);
        }
      }
      facadeGroup.position.z = eraIndex * ERA_Z_STAGGER;
      const facadeLayer = makeEraLayer(year, facadeGroup);
      bayGroup.add(facadeGroup);
      registerEmissiveAnims(facadeLayer, variant.emissive.character, year + slot.index * 13, slot.id);
      facadeLayers.push(facadeLayer);

      // Signage layer group.
      const signageGroup = new THREE.Group();
      signageGroup.add(buildFasciaSign(art.fascia, variant));
      signageGroup.add(buildTransomSign(art.transom, variant));
      const blade = buildBladeSign(art.blade ?? art.fascia, variant);
      if (blade) signageGroup.add(blade);
      const ticker = buildTicker(art.ticker ?? art.fascia, variant);
      if (ticker) signageGroup.add(ticker);
      const menu = buildMenuBoard(art.menuBoard ?? art.fascia, variant);
      if (menu) signageGroup.add(menu);
      const projection = buildProjectionGlass(art.windowDisplay, variant);
      if (projection) signageGroup.add(projection);
      signageGroup.position.z = eraIndex * ERA_Z_STAGGER;
      const signageLayer = makeEraLayer(year, signageGroup);
      bayGroup.add(signageGroup);
      registerEmissiveAnims(signageLayer, variant.emissive.character, year + slot.index * 7, slot.id);
      signageLayers.push(signageLayer);

      // Ticker scroll animation.
      if (art.ticker) {
        tickerAnims.push({
          layer: signageLayer,
          texture: art.ticker.texture,
          speed: variant.year === 2025 ? 0.14 : 0.1,
        });
      }
    });

    pieces.push(
      createMorphPiece({
        id: `shopfront-${slot.id}`,
        stage: 'facade',
        layers: facadeLayers,
        tintMaterials: shell.tintMaterials,
        initialEra: initialYear,
        onSwap: (pieceId, era) =>
          emit({
            type: STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
            sourceId: pieceId,
            era,
            intensity: 1,
            time: clock,
          }),
        onBlend: rememberBlend,
      }),
    );
    pieces.push(
      createMorphPiece({
        id: `signage-${slot.id}`,
        stage: 'signage',
        layers: signageLayers,
        initialEra: initialYear,
        onSwap: (pieceId, era) =>
          emit({
            type: STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
            sourceId: pieceId,
            era,
            intensity: 1,
            time: clock,
          }),
        onBlend: rememberBlend,
      }),
    );

    bayInfo.push({
      id: slot.id,
      index: slot.index,
      x: slot.x,
      z: slot.z,
      treatments,
    });

    pickables.push({
      id: `storefront:shopfront:${slot.id}`,
      object: bayGroup,
      focusDistance: 9,
      focusHeight: 1.7,
      label: treatments[initialYear].brand,
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Poster wall (one InstancedMesh per era across all piers)                */
  /* ---------------------------------------------------------------------- */
  const posterSlots: PosterSlot[] = slots.map((slot) => ({
    x: slot.x + BAY_SLOT_PITCH / 2,
    y: POSTER_Y,
    z: 0.14,
    rotationY: slot.rotationY,
  }));
  const posterRoot = new THREE.Group();
  posterRoot.name = 'poster-wall';
  group.add(posterRoot);
  const posterLayers: (EraLayer | null)[] = [];
  years.forEach((year, eraIndex) => {
    const variant = ERA_STOREFRONT_VARIANTS[year];
    const mesh = buildPosterWall(sharedArt.get(year)!.poster, variant, posterSlots);
    const holder = new THREE.Group();
    holder.position.z = eraIndex * ERA_Z_STAGGER;
    holder.add(mesh);
    posterRoot.add(holder);
    const layer = makeEraLayer(year, holder);
    registerEmissiveAnims(layer, variant.emissive.character, year + 101, 'poster-wall');
    posterLayers.push(layer);
  });
  pieces.push(
    createMorphPiece({
      id: 'signage-poster-wall',
      stage: 'signage',
      layers: posterLayers,
      initialEra: initialYear,
      onSwap: (pieceId, era) =>
        emit({
          type: STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
          sourceId: pieceId,
          era,
          intensity: 1,
          time: clock,
        }),
      onBlend: rememberBlend,
    }),
  );
  pickables.push({
    id: 'storefront:poster-wall',
    object: posterRoot,
    focusDistance: 12,
    focusHeight: 1.7,
    label: 'Poster wall',
  });

  /* ---------------------------------------------------------------------- */
  /* Rooftop + wall billboards                                               */
  /* ---------------------------------------------------------------------- */
  const rowCenterX = slots[Math.floor((slots.length - 1) / 2)].x;
  const lastX = slots[slots.length - 1].x;
  const billboardSpecs = [
    {
      id: 'billboard-rooftop',
      label: 'Rooftop billboard',
      width: 10,
      height: 3.6,
      position: new THREE.Vector3(rowCenterX, 7.2, -0.5),
      rotationY: 0,
    },
    {
      id: 'billboard-wall',
      label: 'Wall billboard',
      width: 5,
      height: 2.8,
      position: new THREE.Vector3(lastX + BAY_SLOT_PITCH / 2 + 0.4, 5.4, -0.4),
      rotationY: Math.PI / 2,
    },
  ];

  for (const spec of billboardSpecs) {
    const frame = buildBillboardFrame(spec.width, spec.height);
    frame.position.copy(spec.position);
    frame.rotation.y = spec.rotationY;
    group.add(frame);

    const faceLayers: (EraLayer | null)[] = [];
    years.forEach((year, eraIndex) => {
      const variant = ERA_STOREFRONT_VARIANTS[year];
      const holder = new THREE.Group();
      holder.position.copy(spec.position);
      holder.rotation.y = spec.rotationY;
      holder.position.z += eraIndex * ERA_Z_STAGGER * Math.cos(spec.rotationY);
      holder.add(
        buildBillboardFace(sharedArt.get(year)!.billboard, variant, spec.width, spec.height),
      );
      group.add(holder);
      const layer = makeEraLayer(year, holder);
      registerEmissiveAnims(layer, variant.emissive.character, year + 211, spec.id);
      faceLayers.push(layer);
    });

    pieces.push(
      createMorphPiece({
        id: spec.id,
        stage: 'signage',
        layers: faceLayers,
        initialEra: initialYear,
        onSwap: (pieceId, era) =>
          emit({
            type: STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
            sourceId: pieceId,
            era,
            intensity: 1,
            time: clock,
          }),
        onBlend: rememberBlend,
      }),
    );
    pickables.push({
      id: `storefront:${spec.id}`,
      object: frame,
      focusDistance: 26,
      focusHeight: 6,
      label: spec.label,
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Pavement kiosk + newsstand rack                                         */
  /* ---------------------------------------------------------------------- */
  const kioskX = slots[Math.min(1, slots.length - 1)].x;
  const kioskStructure = buildKioskStructure();
  kioskStructure.position.set(kioskX, BAY_BASE_Y, SIDEWALK_Z + 0.2);
  group.add(kioskStructure);
  const kioskLayers: (EraLayer | null)[] = [];
  years.forEach((year, eraIndex) => {
    const variant = ERA_STOREFRONT_VARIANTS[year];
    const holder = new THREE.Group();
    holder.position.copy(kioskStructure.position);
    holder.position.z += eraIndex * ERA_Z_STAGGER;
    holder.add(buildKioskFace(sharedArt.get(year)!.kiosk, variant));
    group.add(holder);
    const layer = makeEraLayer(year, holder);
    registerEmissiveAnims(layer, variant.emissive.character, year + 307, 'kiosk');
    kioskLayers.push(layer);
  });
  pieces.push(
    createMorphPiece({
      id: 'signage-kiosk',
      stage: 'signage',
      layers: kioskLayers,
      initialEra: initialYear,
      onSwap: (pieceId, era) =>
        emit({
          type: STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
          sourceId: pieceId,
          era,
          intensity: 1,
          time: clock,
        }),
      onBlend: rememberBlend,
    }),
  );
  pickables.push({
    id: 'storefront:kiosk',
    object: kioskStructure,
    focusDistance: 6,
    focusHeight: 1.6,
    label: 'Advertising kiosk',
  });

  const newsX = slots[Math.max(0, slots.length - 2)].x;
  const newsStructure = buildNewsstandStructure();
  newsStructure.position.set(newsX, BAY_BASE_Y, SIDEWALK_Z + 0.4);
  newsStructure.rotation.y = Math.PI;
  group.add(newsStructure);
  const newsLayers: (EraLayer | null)[] = [];
  years.forEach((year, eraIndex) => {
    const variant = ERA_STOREFRONT_VARIANTS[year];
    const holder = new THREE.Group();
    holder.position.copy(newsStructure.position);
    holder.rotation.y = newsStructure.rotation.y;
    holder.position.z += eraIndex * ERA_Z_STAGGER;
    holder.add(buildNewsstandFace(sharedArt.get(year)!.newsstand, variant));
    group.add(holder);
    const layer = makeEraLayer(year, holder);
    registerEmissiveAnims(layer, variant.emissive.character, year + 401, 'newsstand');
    newsLayers.push(layer);
  });
  pieces.push(
    createMorphPiece({
      id: 'signage-newsstand',
      stage: 'signage',
      layers: newsLayers,
      initialEra: initialYear,
      onSwap: (pieceId, era) =>
        emit({
          type: STOREFRONT_AUDIO_HOOKS.SIGN_SWAP,
          sourceId: pieceId,
          era,
          intensity: 1,
          time: clock,
        }),
      onBlend: rememberBlend,
    }),
  );
  pickables.push({
    id: 'storefront:newsstand',
    object: newsStructure,
    focusDistance: 8,
    focusHeight: 1.7,
    label: 'Newsstand rack',
  });

  /* ---------------------------------------------------------------------- */
  /* Initial era state                                                       */
  /* ---------------------------------------------------------------------- */
  const initialBlend: EraBlend = { from: initialYear, to: nextYear, fraction: 0 };
  for (const piece of pieces) {
    piece.applyEraBlend(initialBlend, stageOffsetOf(piece.stage), 1);
  }

  /* ---------------------------------------------------------------------- */
  /* Public surface                                                          */
  /* ---------------------------------------------------------------------- */
  const module: StorefrontsModule = {
    group,
    bays: slots,
    bayInfo,
    transformables: pieces,
    pickables,
    audioHooks: STOREFRONT_AUDIO_HOOK_LIST,

    register(registry: EraTransformRegistry): () => void {
      const unsubscribers = pieces.map((piece) => registry.register(piece));
      return () => {
        for (const off of unsubscribers) off();
      };
    },

    update(deltaSeconds: number, _elapsedSeconds?: number): number {
      if (disposed) return 0;
      const dt = Math.max(0, deltaSeconds);
      clock += dt;
      let emitted = 0;

      // LED/window ticker scroll.
      for (const ticker of tickerAnims) {
        if (!ticker.layer.object.visible || ticker.layer.weight <= 0.004) continue;
        const x = ticker.texture.offset.x - dt * ticker.speed;
        ticker.texture.offset.x = x - Math.floor(x);
      }

      // Emissive drive: neon flicker, LED scan, backlit buzz, tube flutter.
      for (const anim of emissiveAnims) {
        const w = anim.layer.weight * anim.layer.flare;
        if (!anim.layer.object.visible || w <= 0.004) {
          if (anim.entry.material.emissiveIntensity !== 0) {
            anim.entry.material.emissiveIntensity = 0;
          }
          continue;
        }
        let flicker = 1;
        const bucket = Math.floor(clock * 12);
        if (anim.kind === 'neon') {
          const n = hashNoise(bucket, anim.seed);
          // Random dropouts plus a guaranteed blink at least every 4 s of
          // active ambience, so neon flicker (and its audio hook) is
          // observable evidence rather than luck of the hash.
          const due = clock - anim.lastFlicker > 4;
          const dropout = n < 0.1 || due;
          flicker = dropout ? 0.18 + n * 0.3 : 1;
          flicker *= 0.97 + 0.03 * Math.sin(clock * 9 + anim.seed);
          if (dropout && clock - anim.lastFlicker > 0.35) {
            anim.lastFlicker = clock;
            emit({
              type: STOREFRONT_AUDIO_HOOKS.NEON_FLICKER,
              sourceId: anim.sourceId,
              era: anim.layer.era,
              intensity: w,
              time: clock,
            });
            emitted += 1;
          }
        } else if (anim.kind === 'led') {
          const n = hashNoise(bucket, anim.seed);
          flicker = (n < 0.05 ? 0.55 : 1) * (0.9 + 0.1 * Math.sin(clock * 7 + anim.seed));
        } else if (anim.kind === 'backlit') {
          flicker = 0.96 + 0.04 * Math.sin(clock * 2.7 + anim.seed);
        } else if (anim.kind === 'fluorescent') {
          const n = hashNoise(Math.floor(clock * 6), anim.seed);
          flicker = (n < 0.08 ? 0.7 : 1) * (0.98 + 0.02 * Math.sin(clock * 11 + anim.seed));
        } else {
          flicker = 0.92 + 0.08 * Math.sin(clock * 3.1 + anim.seed * 1.7);
        }
        anim.entry.material.emissiveIntensity = anim.entry.baseEmissive * w * flicker;
      }

      // Scheduled ambience hooks for the currently dominant era.
      const dominant = dominantOf(rawWeights);
      const weight = rawWeights[dominant] ?? 0;
      if (weight > 0.5) {
        const hooks = ERA_STOREFRONT_VARIANTS[dominant].audioHooks;
        for (const hook of hooks) {
          if (hook === STOREFRONT_AUDIO_HOOKS.SIGN_SWAP) continue;
          const interval = HOOK_INTERVALS[hook];
          if (interval === undefined) continue;
          const last = hookLastEmit.get(hook);
          if (last !== undefined && clock - last < interval) continue;
          hookLastEmit.set(hook, clock);
          emit({ type: hook, sourceId: `storefronts:${dominant}`, era: dominant, intensity: weight, time: clock });
          emitted += 1;
        }
      }
      return emitted;
    },

    onAudioEvent(listener: (event: StorefrontAudioEvent) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    pieceSnapshots(): StorefrontPieceSnapshot[] {
      return pieces.map((piece) => piece.snapshot());
    },

    eraWeights(): Record<EraYear, number> {
      return { ...rawWeights };
    },

    dominantEra(): EraYear {
      return dominantOf(rawWeights);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) material.dispose();
      });
      group.clear();
      group.removeFromParent();
      listeners.clear();
      pieces.length = 0;
      emissiveAnims.length = 0;
      tickerAnims.length = 0;
    },
  };

  return module;
}

/**
 * Namespace-style entry covering both construction and shared constants:
 * `StorefrontsModule.create({...})` builds the module; the bay-slot
 * constants and documented audio hooks ride along for the integration owner.
 */
export const StorefrontsModule = {
  create: createStorefrontsModule,
  BAY_SLOT_PITCH,
  BAY_CLEAR_WIDTH,
  BAY_BASE_Y,
  SIGN_BAND_MIN_Y,
  SIGN_BAND_MAX_Y,
  audioHooks: STOREFRONT_AUDIO_HOOK_LIST,
} as const;

/* -------------------------------------------------------------------------- */
/* Re-exports: storefronts-api surface                                         */
/* -------------------------------------------------------------------------- */

export {
  BAY_BASE_Y,
  BAY_CLEAR_WIDTH,
  BAY_SLOT_PITCH,
  ERA_STOREFRONT_VARIANTS,
  SIGN_BAND_CENTER_Y,
  SIGN_BAND_HEIGHT,
  SIGN_BAND_MAX_Y,
  SIGN_BAND_MIN_Y,
  STOREFRONT_AUDIO_HOOKS,
  STOREFRONT_AUDIO_HOOK_LIST,
  STOREFRONT_VARIANT_YEARS,
  brandForBay,
  createBaySlots,
  getStorefrontVariant,
  headlineForSlot,
  taglineForBay,
} from './variants';
export type {
  AwningKind,
  BaySlot,
  BaySlotOptions,
  BillboardKind,
  BladeSignKind,
  EmissiveDrive,
  EraStorefrontVariant,
  FasciaSignKind,
  KioskKind,
  NewsstandKind,
  StorefrontAudioHook,
  TransomSignKind,
  WindowDisplayKind,
} from './variants';
export {
  createBaySignageArt,
  createBillboardTexture,
  createBladeSignTexture,
  createEraFasciaSet,
  createFasciaSignTexture,
  createKioskPosterTexture,
  createMenuBoardTexture,
  createNewsstandTexture,
  createPosterTexture,
  createTickerTexture,
  createTransomLetteringTexture,
  createWindowDisplayTexture,
  disposeSignageTextureCache,
  signageCacheSize,
} from './signage';
export type { BaySignageArt, SignageArtOptions, SignageTexture } from './signage';
export {
  buildAwning,
  buildWindowDisplay,
  frameColorFor,
  makeEraLayer,
  setLayerWeight,
} from './displays';
export type { EraLayer, LayerMaterial } from './displays';
