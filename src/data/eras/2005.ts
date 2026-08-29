/**
 * 2005 era dataset — early-digital city block.
 *
 * An overcast bright day with cooler neutral grading: glass office mid-rises
 * rising above chain-retail ground floors, satellite dishes and AC units on
 * the roofs, silver/grey sedans, minivans, SUVs, delivery vans, and taxis in
 * denser traffic, first LED traffic signals beside HPS/fluorescent lamps,
 * storefronts for a mobile phone shop, internet café, coffee chain, DVD
 * rental, budget fashion, and pharmacy, printed posters and bus-stop ad
 * panels plus the first scrolling LED sign, CCTV poles, bollards, bike
 * racks, wheelie bins, and A-board signs, and pedestrians in 2000s fashion —
 * jeans, trainers, hoodies, low-rise jeans, flip phones, backpacks.
 *
 * This file is DATA ONLY — subsystems construct geometry and materials FROM
 * it; no 3D geometry lives here. Texture paths resolve relative to
 * `src/assets/`, audio cue paths relative to `src/audio/`.
 */
import type { TimeEra } from '../../engine/eras';

export const era2005: TimeEra = {
  id: '2005',
  year: 2005,
  label: 'Millennium',
  description:
    'Early-digital: glass office mid-rises above chain retail, silver SUVs and taxis in dense traffic, LED signals, and the first scrolling LED sign on an overcast bright day.',

  environment: {
    timeOfDay: 'day',
    weather: 'overcast bright day with soft diffuse light and a thin high haze',
    grading: 'cooler-neutral',
    skyColor: { r: 0.62, g: 0.68, b: 0.74 },
    horizonColor: { r: 0.78, g: 0.82, b: 0.85 },
    fogColor: { r: 0.72, g: 0.76, b: 0.8 },
    fogStart: 14,
    fogEnd: 60,
    haze: {
      color: { r: 0.82, g: 0.85, b: 0.87 },
      density: 0.28,
      particleCount: 160,
    },
    streetlights: {
      color: { r: 1.0, g: 0.72, b: 0.42 },
      poolColor: { r: 0.96, g: 0.68, b: 0.4 },
      intensity: 0.55,
    },
    sun: {
      color: { r: 0.92, g: 0.95, b: 1.0 },
      intensity: 0.85,
      elevationDeg: 42,
      azimuthDeg: 152,
    },
    ambientIntensity: 0.65,
  },

  buildings: {
    style: 'glass office mid-rises with chain-retail ground floors and rooftop plant',
    material: 'blue-green glass curtain walls, aluminium mullions, and precast concrete retail bases',
    facadeTexture: {
      path: 'textures/2005/glass-curtain-wall.svg',
      usage: 'Repeated blue-green glass curtain-wall texture for office mid-rise facades.',
    },
    facadePalette: [
      { r: 0.55, g: 0.66, b: 0.71 },
      { r: 0.66, g: 0.72, b: 0.76 },
      { r: 0.78, g: 0.81, b: 0.83 },
    ],
    heightRange: [8.0, 13.5],
    windows: {
      color: { r: 0.7, g: 0.85, b: 0.95 },
      emissiveIntensity: 0.9,
      blackoutShutters: false,
      litFraction: 0.5,
      shutterTexture: {
        path: 'textures/2005/window-grid.svg',
        usage: 'Curtain-wall window grid texture for the office mid-rise facades.',
      },
    },
    rubbleLots: {
      count: 0,
      texture: {
        path: 'textures/2005/retail-ground-floor.svg',
        usage: 'Precast concrete retail ground-floor base for the mid-rise buildings.',
      },
      temporaryShoring: false,
    },
    rooftopProps: ['ac-unit', 'satellite-dish', 'rooftop-tank', 'antenna-mast'],
  },

  vehicles: [
    {
      id: 'silver-sedan',
      kind: 'civilian',
      modelName: '2000s silver mid-size sedan',
      count: 5,
      bodyPalette: [
        { r: 0.62, g: 0.64, b: 0.66 },
        { r: 0.45, g: 0.47, b: 0.5 },
        { r: 0.72, g: 0.74, b: 0.76 },
      ],
      speedRange: [3.4, 5.2],
      note: 'Smooth silver four-door with rounded headlamps and tinted glass.',
    },
    {
      id: 'grey-sedan',
      kind: 'civilian',
      modelName: '2000s grey family sedan',
      count: 3,
      bodyPalette: [
        { r: 0.32, g: 0.34, b: 0.37 },
        { r: 0.42, g: 0.44, b: 0.46 },
        { r: 0.24, g: 0.26, b: 0.28 },
      ],
      speedRange: [3.0, 4.8],
      note: 'Washed-out grey saloon with a roof rack and a fading dealer plate.',
    },
    {
      id: 'minivan',
      kind: 'civilian',
      modelName: '2000s minivan',
      count: 3,
      bodyPalette: [
        { r: 0.56, g: 0.58, b: 0.6 },
        { r: 0.36, g: 0.39, b: 0.42 },
        { r: 0.66, g: 0.68, b: 0.7 },
      ],
      speedRange: [2.8, 4.2],
      note: 'Sliding-door people carrier ferrying kids and shopping.',
    },
    {
      id: 'suv',
      kind: 'civilian',
      modelName: '2000s boxy SUV',
      count: 4,
      bodyPalette: [
        { r: 0.46, g: 0.48, b: 0.5 },
        { r: 0.3, g: 0.32, b: 0.34 },
        { r: 0.58, g: 0.59, b: 0.6 },
      ],
      speedRange: [3.2, 4.8],
      note: 'Tall silver body-on-frame SUV with a chrome grille and roof rails.',
    },
    {
      id: 'delivery-van',
      kind: 'civilian',
      modelName: '2000s panel delivery van',
      count: 3,
      bodyPalette: [
        { r: 0.62, g: 0.64, b: 0.66 },
        { r: 0.3, g: 0.32, b: 0.35 },
        { r: 0.82, g: 0.84, b: 0.85 },
      ],
      speedRange: [2.4, 3.6],
      note: 'White courier vans with printed side logos double-parked at the curb.',
    },
    {
      id: 'taxi',
      kind: 'civilian',
      modelName: '2000s city taxi',
      count: 4,
      bodyPalette: [
        { r: 0.86, g: 0.72, b: 0.12 },
        { r: 0.72, g: 0.58, b: 0.08 },
        { r: 0.1, g: 0.1, b: 0.12 },
      ],
      speedRange: [3.6, 5.4],
      note: 'Yellow cab with a rooftop sign and a rear bumper covered in stickers.',
    },
  ],

  storefronts: [
    {
      id: 'mobile-phone-shop',
      kind: 'mobile-phone-shop',
      name: 'CellPoint Mobile',
      sign: {
        material: 'plastic-illuminated',
        text: 'CELLPOINT MOBILE — PHONES · PLANS · TOP-UPS',
        texture: {
          path: 'textures/2005/mobile-phone-shop-sign.svg',
          usage: 'Blue illuminated sign above the mobile phone shop.',
        },
        background: { r: 0.04, g: 0.24, b: 0.57 },
        foreground: { r: 1.0, g: 1.0, b: 1.0 },
      },
      windowDisplay: 'Racks of flip phones and candy-bar handsets, pay-as-you-go SIM cards, and a plasma screen looping handset ads.',
    },
    {
      id: 'internet-cafe',
      kind: 'internet-cafe',
      name: 'NetCafe 2000',
      sign: {
        material: 'plastic-illuminated',
        text: 'NETCAFE 2000 — BROADBAND · GAMING · PRINTS',
        texture: {
          path: 'textures/2005/internet-cafe-sign.svg',
          usage: 'Teal-on-navy internet café sign with a monitor motif.',
        },
        background: { r: 0.05, g: 0.12, b: 0.24 },
        foreground: { r: 0.22, g: 0.91, b: 0.78 },
      },
      windowDisplay: 'Rows of CRT terminals glowing blue, LAN gaming rigs, and a printer queue by the door.',
    },
    {
      id: 'coffee-chain',
      kind: 'coffee-chain',
      name: 'Beanworks Coffee',
      sign: {
        material: 'plastic-illuminated',
        text: 'BEANWORKS COFFEE — ESPRESSO · LATTE · FREE WI-FI',
        texture: {
          path: 'textures/2005/coffee-chain-sign.svg',
          usage: 'Green illuminated coffee chain sign over the ground-floor café.',
        },
        background: { r: 0.04, g: 0.24, b: 0.18 },
        foreground: { r: 1.0, g: 1.0, b: 1.0 },
      },
      windowDisplay: 'Steam rising from the espresso bar, pastel chairs, and a queue of takeaway cups.',
    },
    {
      id: 'dvd-rental',
      kind: 'dvd-rental',
      name: 'Flickhouse DVD',
      sign: {
        material: 'plastic-illuminated',
        text: 'FLICKHOUSE DVD — RENT · NEW RELEASES · GAMES',
        texture: {
          path: 'textures/2005/dvd-rental-sign.svg',
          usage: 'Yellow illuminated DVD rental sign with a disc motif.',
        },
        background: { r: 0.11, g: 0.11, b: 0.16 },
        foreground: { r: 1.0, g: 0.82, b: 0.24 },
      },
      windowDisplay: 'Walls of DVD cases, a new-release shelf, and a red-boxed game rack by the counter.',
    },
    {
      id: 'budget-fashion',
      kind: 'budget-fashion',
      name: 'Trendz Fashion',
      sign: {
        material: 'plastic-illuminated',
        text: 'TRENDZ FASHION — LOW PRICES · JEANS · TRAINERS',
        texture: {
          path: 'textures/2005/budget-fashion-sign.svg',
          usage: 'Pink illuminated budget-fashion sign above the clothing store.',
        },
        background: { r: 0.85, g: 0.11, b: 0.31 },
        foreground: { r: 1.0, g: 1.0, b: 1.0 },
      },
      windowDisplay: 'Low-rise jeans stacked on tables, trainer boxes, and a sale rail blocking the door.',
    },
    {
      id: 'pharmacy',
      kind: 'pharmacy',
      name: 'Wellcare Pharmacy',
      sign: {
        material: 'plastic-illuminated',
        text: 'WELLCARE PHARMACY — PRESCRIPTIONS · HEALTH & BEAUTY',
        texture: {
          path: 'textures/2005/pharmacy-sign.svg',
          usage: 'Green illuminated pharmacy sign with a cross motif.',
        },
        background: { r: 0.05, g: 0.48, b: 0.24 },
        foreground: { r: 1.0, g: 1.0, b: 1.0 },
      },
      windowDisplay: 'Sun-block and vitamin displays, a glowing green cross, and a poster for the flu jab.',
    },
  ],

  advertisements: [
    {
      id: 'mobile-phone-poster',
      kind: 'painted-masonry',
      text: 'NEW GENERATION MOBILE — CAMERA PHONES · 3G · SNAPSHOTS',
      placement: 'printed poster on the dead wall beside the mobile phone shop',
      texture: {
        path: 'textures/2005/bus-stop-ad.svg',
        usage: 'Printed poster ad for camera phones on the side wall.',
      },
      colors: {
        background: { r: 0.96, g: 0.96, b: 0.96 },
        foreground: { r: 0.12, g: 0.37, b: 0.84 },
      },
    },
    {
      id: 'broadband-vinyl',
      kind: 'enamel-sign',
      text: 'BROADBAND NOW AVAILABLE — SIGN UP TODAY · FREE INSTALL',
      placement: 'storefront vinyl on the internet café window',
      texture: {
        path: 'textures/2005/storefront-vinyl.svg',
        usage: 'Vinyl window advertisement for broadband internet.',
      },
      colors: {
        background: { r: 0.93, g: 0.95, b: 0.96 },
        foreground: { r: 0.04, g: 0.24, b: 0.57 },
      },
    },
    {
      id: 'coffee-bus-stop',
      kind: 'painted-masonry',
      text: 'BEANWORKS COFFEE — FREE WI-FI · GRANDE LATTE $3.50',
      placement: 'bus-stop ad panel on the shelter',
      texture: {
        path: 'textures/2005/bus-shelter-panel.svg',
        usage: 'Bus shelter ad panel for the coffee chain.',
      },
      colors: {
        background: { r: 0.91, g: 0.94, b: 0.97 },
        foreground: { r: 0.04, g: 0.24, b: 0.57 },
      },
    },
    {
      id: 'scrolling-led',
      kind: 'enamel-sign',
      text: 'LIVE SCORES · NEWS · TIME — 24/7',
      placement: 'first scrolling LED sign on the corner fascia above the DVD rental',
      texture: {
        path: 'textures/2005/scrolling-led-sign.svg',
        usage: 'Red scrolling LED ticker sign on the corner fascia.',
      },
      colors: {
        background: { r: 0.02, g: 0.02, b: 0.02 },
        foreground: { r: 1.0, g: 0.23, b: 0.12 },
      },
    },
  ],

  props: [
    {
      id: 'bus-shelter',
      kind: 'bus-shelter',
      count: 2,
      texture: {
        path: 'textures/2005/bus-shelter-panel.svg',
        usage: 'Backlit ad panel inside the glass bus shelter.',
      },
      note: 'Glass-and-aluminium shelter with a backlit poster panel and a bench.',
    },
    {
      id: 'cctv-pole',
      kind: 'cctv-pole',
      count: 4,
      note: 'CCTV poles with white camera housings watching the intersection and storefronts.',
    },
    {
      id: 'bollard',
      kind: 'bollard',
      count: 8,
      note: 'Painted steel bollards guarding the pavement corners and the café terrace.',
    },
    {
      id: 'bike-rack',
      kind: 'bike-rack',
      count: 2,
      note: 'Galvanized bike racks outside the internet café, locked with D-locks.',
    },
    {
      id: 'wheelie-bin',
      kind: 'wheelie-bin',
      count: 4,
      note: 'Plastic wheelie bins with lids lined up behind the pharmacy and café.',
    },
    {
      id: 'a-board-sign',
      kind: 'a-board-sign',
      count: 5,
      note: 'A-frame sandwich boards on the pavement for the sale, the pharmacy, and the café specials.',
    },
    {
      id: 'traffic-light-led',
      kind: 'traffic-light-led',
      count: 2,
      note: 'First LED traffic signals — bright crisp red/amber/green modules on black housings.',
    },
    {
      id: 'hps-streetlamp',
      kind: 'hps-streetlamp',
      count: 4,
      note: 'HPS streetlamps and fluorescent wall packs still running daytime, adding a warm pool to the cool day.',
    },
  ],

  pedestrians: {
    totalCount: 18,
    outfits: [
      {
        id: 'jeans-trainers',
        name: 'Jeans & Trainers',
        category: 'civilian',
        palette: [
          { r: 0.26, g: 0.32, b: 0.44 },
          { r: 0.95, g: 0.95, b: 0.98 },
          { r: 0.4, g: 0.42, b: 0.46 },
        ],
        note: 'Boot-cut jeans, white trainers, and a t-shirt under an open zip-up hoodie.',
      },
      {
        id: 'hoodie-backpack',
        name: 'Hoodie & Backpack',
        category: 'civilian',
        palette: [
          { r: 0.3, g: 0.32, b: 0.36 },
          { r: 0.12, g: 0.14, b: 0.18 },
          { r: 0.55, g: 0.58, b: 0.62 },
        ],
        note: 'Grey hoodie over cargo trousers, a school backpack, and a flip phone in hand.',
      },
      {
        id: 'low-rise-jeans',
        name: 'Low-Rise Jeans & Fitted Tee',
        category: 'civilian',
        palette: [
          { r: 0.3, g: 0.36, b: 0.5 },
          { r: 0.85, g: 0.6, b: 0.55 },
          { r: 0.95, g: 0.95, b: 0.98 },
        ],
        note: 'Low-rise boot-cut jeans, a fitted baby tee, and a chunky belt.',
      },
      {
        id: 'flip-phone-commuter',
        name: 'Flip-Phone Commuter',
        category: 'civilian',
        palette: [
          { r: 0.2, g: 0.22, b: 0.26 },
          { r: 0.6, g: 0.62, b: 0.65 },
          { r: 0.92, g: 0.94, b: 0.96 },
        ],
        note: 'Dark jacket over a light shirt, talking into a silver flip phone while walking.',
      },
      {
        id: 'track-suit',
        name: 'Track Suit & Sneakers',
        category: 'civilian',
        palette: [
          { r: 0.35, g: 0.38, b: 0.42 },
          { r: 0.9, g: 0.9, b: 0.92 },
          { r: 0.16, g: 0.18, b: 0.22 },
        ],
        note: 'Zip-up track suit with contrast stripes and chunky white sneakers.',
      },
      {
        id: 'office-worker',
        name: 'Office Worker',
        category: 'civilian',
        palette: [
          { r: 0.14, g: 0.16, b: 0.2 },
          { r: 0.9, g: 0.92, b: 0.94 },
          { r: 0.3, g: 0.32, b: 0.36 },
        ],
        note: 'Dark suit, laptop bag, and a hands-free headset on the way to the mid-rise.',
      },
      {
        id: 'coffee-barista',
        name: 'Coffee Barista',
        category: 'uniformed',
        palette: [
          { r: 0.05, g: 0.24, b: 0.18 },
          { r: 0.95, g: 0.95, b: 0.97 },
          { r: 0.2, g: 0.22, b: 0.24 },
        ],
        note: 'Green apron and black polo, stepping out with a tray of takeaway cups.',
      },
      {
        id: 'courier',
        name: 'Courier',
        category: 'uniformed',
        palette: [
          { r: 0.85, g: 0.3, b: 0.1 },
          { r: 0.1, g: 0.12, b: 0.14 },
          { r: 0.6, g: 0.62, b: 0.65 },
        ],
        note: 'Hi-vis courier vest and cap, wheeling a stacked parcel cart.',
      },
    ],
  },

  audio: {
    trafficProfile: 'dense — a steady stream of cars, vans, and taxis with bus air-brake hisses at the stop',
    eventChancePerMinute: 5.0,
    musicStyle: 'early-2000s pop leaking from the coffee chain and phone shop radios',
    cues: [
      {
        path: '2005/street-ambience.wav',
        category: 'ambient',
        purpose: 'Denser city street room tone with traffic murmur and distant horns.',
      },
      {
        path: '2005/coffee-shop-ambience.wav',
        category: 'ambient',
        purpose: 'Coffee-shop ambience — chatter and cup clatter from Beanworks.',
      },
      {
        path: '2005/traffic-dense.wav',
        category: 'traffic',
        purpose: 'Dense engine-rumble loop bed with passing cars and vans.',
      },
      {
        path: '2005/mobile-ringtone.wav',
        category: 'event',
        purpose: 'Polyphonic mobile phone ringtone one-shot on the sidewalk.',
      },
      {
        path: '2005/bus-air-brakes.wav',
        category: 'event',
        purpose: 'Bus air-brake hiss one-shot at the shelter stop.',
      },
      {
        path: '2005/radio-pop.wav',
        category: 'radio',
        purpose: 'Early-2000s pop drifting out of the coffee chain shop radio.',
      },
    ],
  },

  camera: {
    id: '2005-corner-boulevard',
    label: 'Corner Boulevard at Midday',
    position: { x: 9.6, y: 3.8, z: 7.4 },
    target: { x: 0.2, y: 2.6, z: -0.8 },
    fov: 58,
  },
};

export default era2005;