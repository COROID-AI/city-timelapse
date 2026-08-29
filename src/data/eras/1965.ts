/**
 * 1965 era dataset — mid-century city block.
 *
 * Mid-century optimism: a clear midday sky with warm colour grading and
 * sharper visibility, pastel/terrazzo mid-rise offices with large
 * plate-glass shopfronts and the first neon signs, early sodium street
 * lamps, mid-century sedans and estates alongside London-style buses and a
 * tram, coin-fed parking meters and a red phone box on the kerb, and
 * pedestrians in slim suits, shift dresses, and school uniforms. Café
 * jukebox bleed and steady traffic fill the street.
 *
 * This file is DATA ONLY — subsystems construct geometry and materials FROM
 * it; no 3D geometry lives here. Texture paths resolve relative to
 * `src/assets/`, audio cue paths relative to `src/audio/`.
 */
import type { TimeEra } from '../../engine/eras';

export const era1965: TimeEra = {
  id: '1965',
  year: 1965,
  label: 'Mid-Century',
  description:
    'Mid-century optimism: pastel terrazzo offices, chrome sedans and buses, neon signs, and sodium lamps under a bright midday sky.',

  environment: {
    timeOfDay: 'midday',
    weather: 'clear midday sky with high, bright clouds',
    grading: 'warm-vivid',
    skyColor: { r: 0.36, g: 0.56, b: 0.78 },
    horizonColor: { r: 0.76, g: 0.8, b: 0.84 },
    fogColor: { r: 0.72, g: 0.76, b: 0.8 },
    fogStart: 28,
    fogEnd: 90,
    haze: {
      color: { r: 0.62, g: 0.6, b: 0.56 },
      density: 0.1,
      particleCount: 24,
    },
    streetlights: {
      color: { r: 1.0, g: 0.66, b: 0.24 },
      poolColor: { r: 0.92, g: 0.56, b: 0.2 },
      intensity: 0.5,
    },
    sun: {
      color: { r: 1.0, g: 0.96, b: 0.86 },
      intensity: 1.25,
      elevationDeg: 54,
      azimuthDeg: 168,
    },
    ambientIntensity: 0.68,
  },

  buildings: {
    style: 'mid-century mid-rise offices with pastel terrazzo facades',
    material: 'pastel-painted concrete and terrazzo with gleaming aluminium window frames',
    facadeTexture: {
      path: 'textures/1965/pastel-terrazzo.svg',
      usage: 'Pastel terrazzo facade texture for mid-rise office blocks.',
    },
    facadePalette: [
      { r: 0.7, g: 0.76, b: 0.7 },
      { r: 0.72, g: 0.78, b: 0.86 },
      { r: 0.88, g: 0.8, b: 0.68 },
      { r: 0.82, g: 0.7, b: 0.68 },
    ],
    heightRange: [3.4, 7.4],
    windows: {
      color: { r: 0.66, g: 0.8, b: 0.94 },
      emissiveIntensity: 0.55,
      blackoutShutters: false,
      litFraction: 0.3,
      shutterTexture: {
        path: 'textures/1965/roller-shutter.svg',
        usage: 'Steel roller shutters for the large plate-glass shopfronts (no blackout shutters in 1965).',
      },
    },
    rubbleLots: {
      count: 1,
      texture: {
        path: 'textures/1965/cleared-car-park.svg',
        usage: 'Cleared former bombsite surfaced as a car park (brief rebuilding gap).',
      },
      temporaryShoring: false,
    },
    rooftopProps: ['neon-rooftop-sign', 'water-tower', 'ventilator-cowls', 'tv-aerial'],
  },

  vehicles: [
    {
      id: 'chevrolet-bel-air',
      kind: 'civilian',
      modelName: 'Chevrolet Bel Air sedan',
      count: 4,
      bodyPalette: [
        { r: 0.12, g: 0.42, b: 0.36 },
        { r: 0.72, g: 0.28, b: 0.22 },
        { r: 0.86, g: 0.84, b: 0.78 },
      ],
      speedRange: [2.8, 4.4],
      note: 'Chrome-trimmed mid-century sedan with tail fins and whitewall tyres.',
    },
    {
      id: 'ford-country-squire',
      kind: 'civilian',
      modelName: 'Ford Country Squire estate wagon',
      count: 2,
      bodyPalette: [
        { r: 0.64, g: 0.62, b: 0.52 },
        { r: 0.3, g: 0.28, b: 0.24 },
      ],
      speedRange: [2.4, 3.9],
      note: 'Wood-panelled station wagon — the family car of the mid-century suburb.',
    },
    {
      id: 'vauxhall-victor',
      kind: 'civilian',
      modelName: 'Vauxhall Victor saloon',
      count: 3,
      bodyPalette: [
        { r: 0.5, g: 0.12, b: 0.14 },
        { r: 0.18, g: 0.3, b: 0.4 },
      ],
      speedRange: [2.6, 4.0],
      note: 'British family saloon with a two-tone pastel paint job.',
    },
    {
      id: 'london-routemaster',
      kind: 'civilian',
      modelName: 'London Routemaster double-decker bus',
      count: 2,
      bodyPalette: [
        { r: 0.74, g: 0.1, b: 0.12 },
        { r: 0.96, g: 0.92, b: 0.8 },
      ],
      speedRange: [2.2, 3.4],
      note: 'Red double-decker bus with open rear platform and conductor.',
    },
    {
      id: 'blackpool-tram',
      kind: 'civilian',
      modelName: 'Blackpool-coronation tram',
      count: 1,
      bodyPalette: [
        { r: 0.1, g: 0.34, b: 0.42 },
        { r: 0.9, g: 0.86, b: 0.7 },
      ],
      speedRange: [2.0, 3.2],
      note: 'Green interurban tram running the boulevard service.',
    },
  ],

  storefronts: [
    {
      id: 'cafe',
      kind: 'cafe',
      name: 'The Vespa Café',
      sign: {
        material: 'neon-tube',
        text: 'VESPA CAFÉ',
        texture: {
          path: 'textures/1965/cafe-sign.svg',
          usage: 'First neon sign above the café — pink tubes on a deep red box.',
        },
        background: { r: 0.42, g: 0.06, b: 0.08 },
        foreground: { r: 0.98, g: 0.45, b: 0.52 },
      },
      windowDisplay: 'Gleaming espresso machine, Formica tables, and a Wurlitzer jukebox in the corner.',
    },
    {
      id: 'record-shop',
      kind: 'record-shop',
      name: 'Disc-O-Rama',
      sign: {
        material: 'plastic-face',
        text: 'DISC-O-RAMA RECORDS',
        texture: {
          path: 'textures/1965/record-shop-sign.svg',
          usage: 'White plastic-face sign with illuminated letters.',
        },
        background: { r: 0.1, g: 0.2, b: 0.26 },
        foreground: { r: 0.96, g: 0.82, b: 0.4 },
      },
      windowDisplay: 'LP bins, amplifiers in the window, and paper record sleeves pinned to the wall.',
    },
    {
      id: 'dry-cleaner',
      kind: 'dry-cleaner',
      name: 'Crown Dry Cleaners',
      sign: {
        material: 'plastic-face',
        text: 'CROWN CLEANERS',
        texture: {
          path: 'textures/1965/dry-cleaner-sign.svg',
          usage: 'Illuminated plastic-face sign with a crown device.',
        },
        background: { r: 0.16, g: 0.3, b: 0.24 },
        foreground: { r: 0.94, g: 0.88, b: 0.72 },
      },
      windowDisplay: 'Hanging garments on a rail, ticket counter, and a steamy press in the back.',
    },
    {
      id: 'bank-branch',
      kind: 'bank-branch',
      name: 'Midland Bank Branch',
      sign: {
        material: 'carved-stone-fascia',
        text: 'MIDLAND BANK',
        texture: {
          path: 'textures/1965/bank-sign.svg',
          usage: 'Stone fascia texture with a brass-letter name plate.',
        },
        background: { r: 0.78, g: 0.76, b: 0.7 },
        foreground: { r: 0.1, g: 0.16, b: 0.24 },
      },
      windowDisplay: 'Deferred storefront with ledgers, a counter, and a new machines desk.',
    },
    {
      id: 'greengrocer',
      kind: 'greengrocer',
      name: "Alf's Fruit & Veg",
      sign: {
        material: 'painted-plastic',
        text: 'FRUIT & VEG',
        texture: {
          path: 'textures/1965/greengrocer-sign.svg',
          usage: 'Painted sign with plastic letters above the greengrocer.',
        },
        background: { r: 0.84, g: 0.8, b: 0.62 },
        foreground: { r: 0.22, g: 0.4, b: 0.2 },
      },
      windowDisplay: 'Crates of tomatoes and oranges, hanging scales, and a hand-written price board.',
    },
  ],

  advertisements: [
    {
      id: 'coca-cola-wall',
      kind: 'painted-masonry',
      text: 'DRINK COCA-COLA',
      placement: 'painted masonry wall beside the record shop',
      texture: {
        path: 'textures/1965/painted-wall-ad.svg',
        usage: 'Painted masonry wall ad with a giant bottle.',
      },
      colors: {
        background: { r: 0.94, g: 0.9, b: 0.8 },
        foreground: { r: 0.62, g: 0.08, b: 0.1 },
      },
    },
    {
      id: 'wurlitzer-ad',
      kind: 'enamel-sign',
      text: 'WURLITZER JUKEBOXES',
      placement: 'first illuminated plastic-face box sign on the café corner',
      texture: {
        path: 'textures/1965/plastic-face-jukebox.svg',
        usage: 'Illuminated plastic-face ad with a glowing record disc.',
      },
      colors: {
        background: { r: 0.08, g: 0.22, b: 0.26 },
        foreground: { r: 1.0, g: 0.62, b: 0.22 },
      },
    },
    {
      id: 'perkins-pastry-ad',
      kind: 'enamel-sign',
      text: 'PERKINS PASTRY — FRESH DAILY',
      placement: 'plastic-face box sign on the bank wall',
      texture: {
        path: 'textures/1965/plastic-face-pastry.svg',
        usage: 'Illuminated plastic-face bakery ad.',
      },
      colors: {
        background: { r: 0.88, g: 0.78, b: 0.58 },
        foreground: { r: 0.3, g: 0.16, b: 0.08 },
      },
    },
  ],

  props: [
    {
      id: 'parking-meter',
      kind: 'parking-meter',
      count: 10,
      note: 'Coin-fed parking meters — new to the block in 1965 — along the kerb.',
    },
    {
      id: 'phone-booth',
      kind: 'phone-booth',
      count: 1,
      texture: {
        path: 'textures/1965/phone-booth.svg',
        usage: 'Red telephone box outside the bank branch.',
      },
      note: 'Red public telephone box with a folding door.',
    },
    {
      id: 'bench',
      kind: 'bench',
      count: 4,
      note: 'Slatted timber benches beside the café terrace and bus stop.',
    },
    {
      id: 'lamp-post',
      kind: 'lamp-post',
      count: 6,
      note: 'Steel lamp posts with early sodium lamps — pale amber light at dusk.',
    },
    {
      id: 'newspaper-stand',
      kind: 'newspaper-stand',
      count: 1,
      texture: {
        path: 'textures/1965/newspaper-stand.svg',
        usage: 'Painted timber stand for the evening papers.',
      },
      note: 'Evening-paper stand with a chalked headline board.',
    },
  ],

  pedestrians: {
    totalCount: 11,
    outfits: [
      {
        id: 'slim-suit',
        name: 'Slim Suit & Narrow Tie',
        category: 'civilian',
        palette: [
          { r: 0.2, g: 0.24, b: 0.3 },
          { r: 0.3, g: 0.3, b: 0.28 },
          { r: 0.12, g: 0.14, b: 0.1 },
        ],
        note: 'Mod-tailored suit with a narrow tie and a short overcoat — the executive look of 1965.',
      },
      {
        id: 'shift-dress',
        name: 'Sixties Shift Dress',
        category: 'civilian',
        palette: [
          { r: 0.78, g: 0.5, b: 0.32 },
          { r: 0.36, g: 0.58, b: 0.62 },
        ],
        note: 'Knee-length shift dress in a block colour with kitten heels and a handbag.',
      },
      {
        id: 'twin-set',
        name: 'Twin Set & Felt Hat',
        category: 'civilian',
        palette: [
          { r: 0.74, g: 0.72, b: 0.66 },
          { r: 0.5, g: 0.34, b: 0.28 },
        ],
        note: 'Cardigan twin set, pearls, and a felt hat — hats are now fading out of everyday wear.',
      },
      {
        id: 'school-uniform',
        name: 'Grammar School Uniform',
        category: 'uniformed',
        palette: [
          { r: 0.3, g: 0.3, b: 0.34 },
          { r: 0.8, g: 0.78, b: 0.72 },
        ],
        note: 'Grey blazer, cap, and satchel — the morning walk to the grammar school.',
      },
      {
        id: 'bus-conductor',
        name: 'Bus Conductor',
        category: 'uniformed',
        palette: [
          { r: 0.26, g: 0.24, b: 0.22 },
          { r: 0.82, g: 0.16, b: 0.12 },
        ],
        note: 'Routemaster conductor uniform with a ticket punch and coin pouch.',
      },
    ],
  },

  audio: {
    trafficProfile: 'busy — sedans, estates, buses, and a tram passing every minute',
    eventChancePerMinute: 3.4,
    musicStyle: 'café jukebox: early-sixties pop, soul, and ska bleeding onto the pavement',
    cues: [
      {
        path: '1965/street-chatter.wav',
        category: 'ambient',
        purpose: 'Street-life chatter, footsteps, and a bright midday city hum.',
      },
      {
        path: '1965/traffic-busy.wav',
        category: 'traffic',
        purpose: 'Steady mid-century traffic rumble loop — buses, trams, and cars.',
      },
      {
        path: '1965/bus-idle.wav',
        category: 'event',
        purpose: 'Routemaster bus idling with an air-brake hiss as it departs.',
      },
      {
        path: '1965/jukebox-bleed.wav',
        category: 'radio',
        purpose: 'Café jukebox bleed: a swinging early-sixties jingle through the open door.',
      },
    ],
  },

  camera: {
    id: '1965-boulevard-corner',
    label: 'Boulevard Corner at Midday',
    position: { x: 5.2, y: 3.1, z: 10.6 },
    target: { x: -0.6, y: 1.6, z: 0 },
    fov: 52,
  },
};

export default era1965;