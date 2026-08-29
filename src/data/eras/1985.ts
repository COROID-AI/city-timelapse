/**
 * 1985 era dataset — neon commercial city block.
 *
 * The downtown block at its neon peak: a clear evening with wet asphalt
 * soaking up magenta/cyan signage glare, concrete-and-glass office slabs
 * rising above old strip-retail ground floors, boxy sedans, hatchbacks,
 * delivery vans, buses, and yellow cabs in denser traffic, storefronts lit
 * by video-rental, arcade, convenience, record, fast-food, and travel
 * agencies, neon signage and billboards, and pedestrians in 1980s fashion —
 * leather jackets, denim, big hair, sneakers, and boomboxes.
 *
 * This file is DATA ONLY — subsystems construct geometry and materials FROM
 * it; no 3D geometry lives here. Texture paths resolve relative to
 * `src/assets/`, audio cue paths relative to `src/audio/`.
 */
import type { TimeEra } from '../../engine/eras';

export const era1985: TimeEra = {
  id: '1985',
  year: 1985,
  label: 'Eighties',
  description:
    'Evening neon canyon: concrete towers, glass-and-steel insertions, strip retail, and magenta-cyan signage glare on wet asphalt.',

  environment: {
    timeOfDay: 'evening',
    weather: 'clear night with wet asphalt, low neon haze, and drizzle sheen on the roadway',
    grading: 'neon-magenta-cyan-blue',
    skyColor: { r: 0.07, g: 0.08, b: 0.17 },
    horizonColor: { r: 0.42, g: 0.16, b: 0.4 },
    fogColor: { r: 0.16, g: 0.07, b: 0.22 },
    fogStart: 6,
    fogEnd: 46,
    haze: {
      color: { r: 0.72, g: 0.24, b: 0.88 },
      density: 0.5,
      particleCount: 220,
    },
    streetlights: {
      color: { r: 1.0, g: 0.62, b: 0.34 },
      poolColor: { r: 0.9, g: 0.52, b: 0.3 },
      intensity: 1.15,
    },
    sun: {
      color: { r: 0.6, g: 0.4, b: 0.58 },
      intensity: 0.35,
      elevationDeg: 6,
      azimuthDeg: 236,
    },
    ambientIntensity: 0.3,
  },

  buildings: {
    style: 'mid-rise office slabs and glass-and-steel insertions above an original strip-retail ground floor',
    material: 'poured concrete, bronze-tint glass curtain walls, and steel mullions',
    facadeTexture: {
      path: 'textures/1985/concrete-facade.svg',
      usage: 'Brutalist concrete panel texture for tower and slab facades.',
    },
    facadePalette: [
      { r: 0.62, g: 0.64, b: 0.7 },
      { r: 0.3, g: 0.42, b: 0.5 },
      { r: 0.55, g: 0.47, b: 0.62 },
    ],
    heightRange: [6.5, 12.5],
    windows: {
      color: { r: 0.55, g: 0.95, b: 1.0 },
      emissiveIntensity: 1.6,
      blackoutShutters: false,
      litFraction: 0.55,
      shutterTexture: {
        path: 'textures/1985/window-grid.svg',
        usage: 'Curtain-wall window grid texture for lit tower facades.',
      },
    },
    rubbleLots: {
      count: 1,
      texture: {
        path: 'textures/1985/vacant-lot.svg',
        usage: 'Vacant redevelopment lot ground between the slab towers.',
      },
      temporaryShoring: false,
    },
    rooftopProps: ['ac-unit', 'satellite-dish', 'rooftop-tank', 'billboard-frame'],
  },

  vehicles: [
    {
      id: 'eighties-sedan',
      kind: 'civilian',
      modelName: '1980s full-size boxy sedan',
      count: 5,
      bodyPalette: [
        { r: 0.12, g: 0.13, b: 0.16 },
        { r: 0.16, g: 0.1, b: 0.08 },
        { r: 0.24, g: 0.24, b: 0.26 },
      ],
      speedRange: [3.2, 5.0],
      note: 'Straight-edged four-door with chrome trim, rolling under the sodium lights.',
    },
    {
      id: 'eighties-hatchback',
      kind: 'civilian',
      modelName: '1980s compact hatchback',
      count: 4,
      bodyPalette: [
        { r: 0.18, g: 0.2, b: 0.24 },
        { r: 0.3, g: 0.12, b: 0.14 },
        { r: 0.2, g: 0.26, b: 0.16 },
      ],
      speedRange: [2.8, 4.6],
      note: 'Economy hatchback with rear wiper and patch-panel repairs.',
    },
    {
      id: 'delivery-van',
      kind: 'civilian',
      modelName: 'Step-van delivery box',
      count: 3,
      bodyPalette: [
        { r: 0.26, g: 0.3, b: 0.34 },
        { r: 0.34, g: 0.28, b: 0.2 },
      ],
      speedRange: [2.2, 3.4],
      note: 'Rusted white step-vans ferrying tapes and office supplies.',
    },
    {
      id: 'city-bus',
      kind: 'civilian',
      modelName: 'MTA city bus',
      count: 2,
      bodyPalette: [
        { r: 0.22, g: 0.28, b: 0.32 },
        { r: 0.85, g: 0.85, b: 0.82 },
      ],
      speedRange: [1.8, 2.8],
      note: 'Articulated-routed diesel bus with a destination marquee.',
    },
    {
      id: 'yellow-cab',
      kind: 'civilian',
      modelName: 'checker-flagged yellow cab',
      count: 4,
      bodyPalette: [
        { r: 0.92, g: 0.68, b: 0.12 },
        { r: 0.8, g: 0.56, b: 0.08 },
      ],
      speedRange: [3.4, 5.4],
      note: 'Shiny yellow cab with a rooftop sign — the night regulars.',
    },
    {
      id: 'pickup',
      kind: 'civilian',
      modelName: 'full-size pickup truck',
      count: 2,
      bodyPalette: [
        { r: 0.3, g: 0.22, b: 0.18 },
        { r: 0.24, g: 0.26, b: 0.3 },
      ],
      speedRange: [2.6, 4.0],
      note: 'Work pickups parked at the curb during an overnight shopfront fit-out.',
    },
  ],

  storefronts: [
    {
      id: 'video-rental',
      kind: 'video-rental',
      name: 'Video Galaxy',
      sign: {
        material: 'neon-in-glass',
        text: 'VIDEO GALAXY — RENT · BUY · BETA & VHS',
        texture: {
          path: 'textures/1985/video-galaxy-sign.svg',
          usage: 'Fuchsia-and-cyan neon sign above the video rental.',
        },
        background: { r: 0.08, g: 0.02, b: 0.17 },
        foreground: { r: 1.0, g: 0.18, b: 0.58 },
      },
      windowDisplay: 'Wall of VHS tapes, cardboard display stands, and a TV playing a trailer loop in the window.',
    },
    {
      id: 'arcade',
      kind: 'arcade',
      name: 'Galaxy Arcade',
      sign: {
        material: 'neon-tube',
        text: 'GALAXY ARCADE — 25¢',
        texture: {
          path: 'textures/1985/galaxy-arcade-sign.svg',
          usage: 'Neon arcade sign with a marquee of cabinet silhouettes.',
        },
        background: { r: 0.03, g: 0.03, b: 0.11 },
        foreground: { r: 1.0, g: 0.24, b: 0.94 },
      },
      windowDisplay: 'Ranks of blinking arcade cabinets; Pac-Man-style screen glow flickers through the door.',
    },
    {
      id: 'convenience-store',
      kind: 'convenience-store',
      name: 'City Mart',
      sign: {
        material: 'plastic-illuminated',
        text: 'CITY MART — 24 HOUR · OPEN LATE',
        texture: {
          path: 'textures/1985/city-mart-sign.svg',
          usage: 'Illuminated red convenience-store sign.',
        },
        background: { r: 0.89, g: 0.02, b: 0.2 },
        foreground: { r: 1.0, g: 1.0, b: 1.0 },
      },
      windowDisplay: 'Stacked soda 6-packs, tabloids, and a humming refrigerated beer door.',
    },
    {
      id: 'record-shop',
      kind: 'record-shop',
      name: 'Disc Drive',
      sign: {
        material: 'neon-accent',
        text: 'DISC DRIVE — LPs · CASSETTES · POSTERS',
        texture: {
          path: 'textures/1985/disc-drive-sign.svg',
          usage: 'Record-shop neon-accent sign over a vinyl facade.',
        },
        background: { r: 0.07, g: 0.02, b: 0.12 },
        foreground: { r: 0.14, g: 0.99, b: 0.86 },
      },
      windowDisplay: 'New-release LP stands, cassette racks, and band posters in the window.',
    },
    {
      id: 'fast-food',
      kind: 'fast-food',
      name: 'Zippy Burgers',
      sign: {
        material: 'plastic-illuminated',
        text: 'ZIPPY BURGERS — FAST · HOT · FLAME-GRILLED',
        texture: {
          path: 'textures/1985/zippy-burgers-sign.svg',
          usage: 'Bright orange fast-food sign glowing onto the sidewalk.',
        },
        background: { r: 1.0, g: 0.48, b: 0.0 },
        foreground: { r: 1.0, g: 1.0, b: 1.0 },
      },
      windowDisplay: 'Golden-arches-style drive-thru menu board and a counter crowd at the lit window.',
    },
    {
      id: 'travel-agency',
      kind: 'travel-agency',
      name: 'Globetrotters Travel',
      sign: {
        material: 'neon-accent',
        text: 'GLOBETROTTERS — TRAVEL · CRUISES · EXCHANGE',
        texture: {
          path: 'textures/1985/globetrotters-travel-sign.svg',
          usage: 'Teal-on-navy travel agency sign.',
        },
        background: { r: 0.0, g: 0.2, b: 0.4 },
        foreground: { r: 0.25, g: 0.88, b: 0.82 },
      },
      windowDisplay: 'Pastel cruise posters and a spinning globe by the door.',
    },
  ],

  advertisements: [
    {
      id: 'radio-billboard',
      kind: 'painted-masonry',
      text: 'SMASH HIT 98 FM — ALL THE HITS · ALL NIGHT',
      placement: 'rooftop billboard above the office slab',
      texture: {
        path: 'textures/1985/billboard-ad.svg',
        usage: 'Backlit radio-station billboard on the tower roof.',
      },
      colors: {
        background: { r: 0.04, g: 0.17, b: 0.31 },
        foreground: { r: 1.0, g: 0.24, b: 0.94 },
      },
    },
    {
      id: 'video-storefront-ad',
      kind: 'enamel-sign',
      text: 'NOW SHOWING — GHOSTBUSTERS — VHS RENTAL $1.99',
      placement: 'illuminated box on the video-rental fascia',
      texture: {
        path: 'textures/1985/window-vinyl.svg',
        usage: 'Glowing window vinyl advertisement for the new-release shelf.',
      },
      colors: {
        background: { r: 0.03, g: 0.1, b: 0.14 },
        foreground: { r: 1.0, g: 0.18, b: 0.58 },
      },
    },
    {
      id: 'cola-neon',
      kind: 'enamel-sign',
      text: 'ICE-COLD COLA — NEON',
      placement: 'freestanding neon sign on the sidewalk by the convenience store',
      texture: {
        path: 'textures/1985/city-mart-sign.svg',
        usage: 'Neon-lit convenience signage doubling as an ad panel.',
      },
      colors: {
        background: { r: 0.93, g: 0.05, b: 0.16 },
        foreground: { r: 1.0, g: 1.0, b: 1.0 },
      },
    },
    {
      id: 'cassette-billboard',
      kind: 'painted-masonry',
      text: 'HIGH BIAS CASSETTES — 90 MIN — LOUDER SOUND',
      placement: 'painted panel on the dead wall of the record shop',
      texture: {
        path: 'textures/1985/disc-drive-sign.svg',
        usage: 'Painted cassette-era ad on the side wall.',
      },
      colors: {
        background: { r: 0.06, g: 0.1, b: 0.2 },
        foreground: { r: 0.14, g: 0.99, b: 0.86 },
      },
    },
  ],

  props: [
    {
      id: 'bus-shelter',
      kind: 'bus-shelter',
      count: 2,
      texture: {
        path: 'textures/1985/billboard-ad.svg',
        usage: 'Illuminated ad panel inside the bus shelter.',
      },
      note: 'Glass-and-steel shelter with a backlit ad panel and a bench.',
    },
    {
      id: 'newspaper-box',
      kind: 'newspaper-box',
      count: 4,
      note: 'Coin-op newspaper boxes chained to a lamppost.',
    },
    {
      id: 'trash-can',
      kind: 'trash-can',
      count: 3,
      note: 'Wired city trash cans with lids, spilling coupons.',
    },
    {
      id: 'bike-rack',
      kind: 'bike-rack',
      count: 2,
      note: 'Galvanized bike racks outside the record shop.',
    },
    {
      id: 'streetlamp-banner',
      kind: 'streetlamp-banner',
      count: 4,
      note: 'Down-turned sodium lamp heads with civic banners strung between poles.',
    },
    {
      id: 'traffic-light',
      kind: 'traffic-light',
      count: 2,
      note: 'Overhead traffic signal with a hung "no turn on red" plate.',
    },
    {
      id: 'payphone',
      kind: 'payphone',
      count: 2,
      note: 'Open-air payphone with a beaten Yellow Pages hanging from the cord.',
    },
    {
      id: 'curb-ramp',
      kind: 'curb-ramp',
      count: 3,
      note: 'Concrete curb cuts glowing with spilled neon light.',
    },
  ],

  pedestrians: {
    totalCount: 16,
    outfits: [
      {
        id: 'leather-jacket',
        name: 'Leather Jacket & Denim',
        category: 'civilian',
        palette: [
          { r: 0.09, g: 0.08, b: 0.1 },
          { r: 0.22, g: 0.28, b: 0.55 },
          { r: 0.45, g: 0.45, b: 0.48 },
        ],
        note: 'Black biker jacket, ripped jeans, and a rolled band tee.',
      },
      {
        id: 'big-hair',
        name: 'Big Hair & Shoulder Pads',
        category: 'civilian',
        palette: [
          { r: 0.85, g: 0.6, b: 0.2 },
          { r: 0.92, g: 0.2, b: 0.45 },
          { r: 0.98, g: 0.98, b: 0.95 },
        ],
        note: 'Teased perm, pastel blazer with power shoulders, and a mini skirt.',
      },
      {
        id: 'denim-jacket',
        name: 'Stonewashed Denim',
        category: 'civilian',
        palette: [
          { r: 0.24, g: 0.34, b: 0.58 },
          { r: 0.1, g: 0.12, b: 0.2 },
          { r: 0.8, g: 0.8, b: 0.82 },
        ],
        note: 'Stonewashed denim jacket and high-waisted jeans, both acid-washed.',
      },
      {
        id: 'sneaker-head',
        name: 'Sneakers & Track Suit',
        category: 'civilian',
        palette: [
          { r: 0.95, g: 0.95, b: 0.98 },
          { r: 0.98, g: 0.35, b: 0.12 },
          { r: 0.6, g: 0.65, b: 0.7 },
        ],
        note: 'White high-top sneakers laced to the top under a warm-up track suit.',
      },
      {
        id: 'boombox-kid',
        name: 'Boombox Kid',
        category: 'civilian',
        palette: [
          { r: 0.4, g: 0.42, b: 0.46 },
          { r: 0.55, g: 0.12, b: 0.2 },
          { r: 0.2, g: 0.22, b: 0.3 },
        ],
        note: 'Carries a twin-cassette boombox on the shoulder, synth-pop audibly leaking.',
      },
      {
        id: 'yuppie-suit',
        name: 'Yuppie Pinstripe',
        category: 'civilian',
        palette: [
          { r: 0.12, g: 0.14, b: 0.18 },
          { r: 0.92, g: 0.94, b: 0.96 },
          { r: 0.15, g: 0.3, b: 0.45 },
        ],
        note: 'Pinstripe suit, thin tie, and a leather briefcase after the office closes.',
      },
      {
        id: 'construction-worker',
        name: 'Construction Worker',
        category: 'uniformed',
        palette: [
          { r: 0.9, g: 0.45, b: 0.05 },
          { r: 0.12, g: 0.16, b: 0.2 },
          { r: 0.35, g: 0.35, b: 0.36 },
        ],
        note: 'Hi-vis vest and hard hat wrapping up on the glass-and-steel insertion.',
      },
      {
        id: 'fast-food-worker',
        name: 'Fast-Food Crew',
        category: 'uniformed',
        palette: [
          { r: 0.97, g: 0.42, b: 0.12 },
          { r: 0.12, g: 0.14, b: 0.16 },
          { r: 0.95, g: 0.9, b: 0.5 },
        ],
        note: 'Capped counter crew taking out trash between rushes.',
      },
    ],
  },

  audio: {
    trafficProfile: 'dense — a cab, van, or bus passes every half-minute with engine rumble and horn blats',
    eventChancePerMinute: 4.2,
    musicStyle: 'synth-pop leaking from shop radios and arcade cabinets',
    cues: [
      {
        path: '1985/neon-hum.wav',
        category: 'ambient',
        purpose: 'Neon-buzz room tone and mains hum for the sign forest.',
      },
      {
        path: '1985/arcade-bleed.wav',
        category: 'ambient',
        purpose: 'Arcade noise bleeding onto the street from Galaxy Arcade.',
      },
      {
        path: '1985/traffic-dense.wav',
        category: 'traffic',
        purpose: 'Dense engine-rumble loop bed with bus and cab passes.',
      },
      {
        path: '1985/car-horn.wav',
        category: 'event',
        purpose: 'City cab horn one-shot during traffic.',
      },
      {
        path: '1985/synth-pop-radio.wav',
        category: 'radio',
        purpose: 'Synth-pop from a shop radio drifting over the sidewalk.',
      },
    ],
  },

  camera: {
    id: '1985-neon-canyon',
    label: 'Neon Canyon at Dusk',
    position: { x: 5.2, y: 3.4, z: 9.8 },
    target: { x: -0.6, y: 2.8, z: 0.4 },
    fov: 62,
  },
};

export default era1985;