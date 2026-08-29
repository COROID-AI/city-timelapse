/**
 * 2025 era dataset — modern glass / smart-city city block.
 *
 * A crisp clear late afternoon with clean air and a low sun: cool modern
 * grading, glass towers with green walls and rooftop solar above smart-glass
 * ground-floor retail, LED street lighting and EV charge points, quiet
 * electric traffic — EVs, e-scooters, e-bikes, EV buses, ride-share cars, and
 * delivery drones overhead with far fewer internal-combustion vehicles —
 * specialty coffee, phone repair, vegan fast-casual, co-working, a plant
 * shop, and an EV chargepoint canopy on the street, digital LED displays and
 * holographic-style projection panels, smart bollards, parklets, planters,
 * and digital bus-stop displays, and pedestrians in 2020s fashion —
 * athleisure, tech-wear, wireless earbuds, backpacks, coffee cups, and phones
 * out.
 *
 * This file is DATA ONLY — subsystems construct geometry and materials FROM
 * it; no 3D geometry lives here. Texture paths resolve relative to
 * `src/assets/`, audio cue paths relative to `src/audio/`.
 */
import type { TimeEra } from '../../engine/eras';

export const era2025: TimeEra = {
  id: '2025',
  year: 2025,
  label: 'Now',
  description:
    'Smart-city glass canyon: EV traffic, rooftop solar and green walls, digital LED media, and specialty retail under a crisp late-afternoon sky.',

  environment: {
    timeOfDay: 'late-afternoon',
    weather: 'crisp clear day with a low late-afternoon sun and clean air',
    grading: 'cool-modern',
    skyColor: { r: 0.42, g: 0.6, b: 0.82 },
    horizonColor: { r: 0.82, g: 0.86, b: 0.9 },
    fogColor: { r: 0.76, g: 0.83, b: 0.9 },
    fogStart: 30,
    fogEnd: 95,
    haze: {
      color: { r: 0.72, g: 0.78, b: 0.86 },
      density: 0.06,
      particleCount: 16,
    },
    streetlights: {
      color: { r: 0.92, g: 0.96, b: 1.0 },
      poolColor: { r: 0.85, g: 0.92, b: 1.0 },
      intensity: 0.7,
    },
    sun: {
      color: { r: 1.0, g: 0.92, b: 0.8 },
      intensity: 1.05,
      elevationDeg: 22,
      azimuthDeg: 262,
    },
    ambientIntensity: 0.62,
  },

  buildings: {
    style: 'contemporary glass towers with green walls, rooftop solar, and smart-glass ground-floor retail',
    material: 'low-iron glass curtain walls, anodised aluminium fins, and living green-wall panels',
    facadeTexture: {
      path: 'textures/2025/glass-facade.svg',
      usage: 'Cool blue-grey glass curtain-wall facade texture for the towers.',
    },
    facadePalette: [
      { r: 0.55, g: 0.68, b: 0.78 },
      { r: 0.42, g: 0.56, b: 0.66 },
      { r: 0.68, g: 0.78, b: 0.84 },
      { r: 0.3, g: 0.42, b: 0.52 },
    ],
    heightRange: [8.5, 16.5],
    windows: {
      color: { r: 0.75, g: 0.88, b: 1.0 },
      emissiveIntensity: 0.9,
      blackoutShutters: false,
      litFraction: 0.42,
      shutterTexture: {
        path: 'textures/2025/smart-glass-window.svg',
        usage: 'Electrochromic smart-glass window panels with slim aluminium mullions.',
      },
    },
    rubbleLots: {
      count: 1,
      texture: {
        path: 'textures/2025/green-park-plaza.svg',
        usage: 'Green pocket-park plaza with planters between the glass towers.',
      },
      temporaryShoring: false,
    },
    rooftopProps: ['rooftop-solar-array', 'green-roof', 'hvac-unit', '5g-antenna', 'drone-pad'],
  },

  vehicles: [
    {
      id: 'ev-sedan',
      kind: 'civilian',
      modelName: 'compact electric sedan',
      count: 4,
      bodyPalette: [
        { r: 0.86, g: 0.88, b: 0.9 },
        { r: 0.3, g: 0.34, b: 0.4 },
        { r: 0.12, g: 0.5, b: 0.46 },
      ],
      speedRange: [3.0, 4.6],
      note: 'Sleek EV with a closed grille and a thin LED light bar, gliding past almost silently.',
    },
    {
      id: 'ride-share-suv',
      kind: 'civilian',
      modelName: 'electric ride-share SUV',
      count: 3,
      bodyPalette: [
        { r: 0.92, g: 0.94, b: 0.96 },
        { r: 0.16, g: 0.18, b: 0.22 },
        { r: 0.62, g: 0.66, b: 0.72 },
      ],
      speedRange: [2.8, 4.2],
      note: 'App-hailed ride-share EV with a roof-mounted beacon and tinted glass.',
    },
    {
      id: 'ev-bus',
      kind: 'civilian',
      modelName: 'battery-electric city bus',
      count: 2,
      bodyPalette: [
        { r: 0.14, g: 0.2, b: 0.28 },
        { r: 0.9, g: 0.92, b: 0.94 },
        { r: 0.2, g: 0.6, b: 0.5 },
      ],
      speedRange: [1.8, 2.8],
      note: 'Zero-emission bus with a digital destination marquee and wheel-arch charge lights.',
    },
    {
      id: 'e-scooter',
      kind: 'civilian',
      modelName: 'shared e-scooter',
      count: 6,
      bodyPalette: [
        { r: 0.85, g: 0.88, b: 0.92 },
        { r: 0.16, g: 0.18, b: 0.2 },
        { r: 0.95, g: 0.28, b: 0.1 },
      ],
      speedRange: [2.2, 4.2],
      note: 'Dockless scooters zipping along the kerb lane with a soft electric whir.',
    },
    {
      id: 'cargo-e-bike',
      kind: 'civilian',
      modelName: 'electric cargo bike',
      count: 4,
      bodyPalette: [
        { r: 0.2, g: 0.24, b: 0.3 },
        { r: 0.95, g: 0.95, b: 0.9 },
        { r: 0.12, g: 0.55, b: 0.48 },
      ],
      speedRange: [2.4, 4.0],
      note: 'Front-box cargo e-bike ferrying takeout and parcels through the bike lane.',
    },
    {
      id: 'delivery-drone',
      kind: 'civilian',
      modelName: 'quadcopter delivery drone',
      count: 3,
      bodyPalette: [
        { r: 0.85, g: 0.88, b: 0.9 },
        { r: 0.12, g: 0.14, b: 0.16 },
        { r: 0.95, g: 0.6, b: 0.1 },
      ],
      speedRange: [4.0, 6.5],
      note: 'Small delivery drones climbing from the drone pad and crossing overhead with a distant whir.',
    },
    {
      id: 'ice-holdout',
      kind: 'civilian',
      modelName: 'late-model hybrid hatchback',
      count: 1,
      bodyPalette: [
        { r: 0.34, g: 0.36, b: 0.38 },
        { r: 0.5, g: 0.52, b: 0.54 },
      ],
      speedRange: [2.6, 3.8],
      note: 'The rare combustion-engine holdout, low and quiet but audibly different from the EV fleet.',
    },
  ],

  storefronts: [
    {
      id: 'specialty-coffee',
      kind: 'specialty-coffee',
      name: 'Daybreak Roasters',
      sign: {
        material: 'led-neon-tube',
        text: 'DAYBREAK ROASTERS — SINGLE ORIGIN · POUR OVER',
        texture: {
          path: 'textures/2025/specialty-coffee-sign.svg',
          usage: 'Warm amber LED-neon sign above the specialty coffee window.',
        },
        background: { r: 0.08, g: 0.09, b: 0.1 },
        foreground: { r: 1.0, g: 0.62, b: 0.28 },
      },
      windowDisplay: 'La Marzocco espresso bar, oat-milk pitchers, and a queue of laptop commuters at the counter.',
    },
    {
      id: 'phone-repair',
      kind: 'phone-repair',
      name: 'GlassFix',
      sign: {
        material: 'led-panel',
        text: 'GLASSFIX — SCREEN REPAIR · 30 MIN',
        texture: {
          path: 'textures/2025/phone-repair-sign.svg',
          usage: 'Cool cyan LED panel sign for the phone-repair storefront.',
        },
        background: { r: 0.04, g: 0.12, b: 0.16 },
        foreground: { r: 0.24, g: 0.9, b: 1.0 },
      },
      windowDisplay: 'A wall of cracked and new phone screens, a same-day repair bench, and a QR order kiosk.',
    },
    {
      id: 'vegan-fast-casual',
      kind: 'vegan-fast-casual',
      name: 'Green Bowl Co.',
      sign: {
        material: 'led-panel',
        text: 'GREEN BOWL — PLANT-BASED · FAST-CASUAL',
        texture: {
          path: 'textures/2025/vegan-kitchen-sign.svg',
          usage: 'Leaf-green LED panel sign over the vegan fast-casual counter.',
        },
        background: { r: 0.05, g: 0.14, b: 0.09 },
        foreground: { r: 0.4, g: 0.95, b: 0.5 },
      },
      windowDisplay: 'Bright salad bowls, a self-order tablet wall, and compostable takeout stacked by the door.',
    },
    {
      id: 'coworking-entrance',
      kind: 'coworking',
      name: 'Hive Workspaces',
      sign: {
        material: 'led-panel',
        text: 'HIVE — CO-WORKING · HOT DESKS · PODS',
        texture: {
          path: 'textures/2025/coworking-sign.svg',
          usage: 'Minimal white-on-charcoal LED sign at the co-working entrance.',
        },
        background: { r: 0.09, g: 0.1, b: 0.12 },
        foreground: { r: 0.96, g: 0.97, b: 1.0 },
      },
      windowDisplay: 'Open lobby with standing desks, a phone-booth pod, and a digital occupancy board.',
    },
    {
      id: 'plant-shop',
      kind: 'plant-shop',
      name: 'Frond & Fern',
      sign: {
        material: 'led-neon-tube',
        text: 'FROND & FERN — HOUSEPLANTS · TERRARIUMS',
        texture: {
          path: 'textures/2025/plant-shop-sign.svg',
          usage: 'Soft green LED-neon sign over the plant-shop window.',
        },
        background: { r: 0.06, g: 0.1, b: 0.08 },
        foreground: { r: 0.45, g: 0.9, b: 0.55 },
      },
      windowDisplay: 'Monsteras and fiddle-leaf figs spilling onto the pavement beside glass terrariums.',
    },
    {
      id: 'ev-chargepoint-canopy',
      kind: 'ev-chargepoint-canopy',
      name: 'VoltHub',
      sign: {
        material: 'led-panel',
        text: 'VOLTHUB — EV CHARGING · 150 kW',
        texture: {
          path: 'textures/2025/ev-charge-canopy-sign.svg',
          usage: 'Blue-white LED sign on the EV chargepoint canopy.',
        },
        background: { r: 0.02, g: 0.05, b: 0.09 },
        foreground: { r: 0.3, g: 0.8, b: 1.0 },
      },
      windowDisplay: 'Canopy with twin fast-charge stalls, a status ring that pulses while charging, and a QR tap-to-pay panel.',
    },
  ],

  advertisements: [
    {
      id: 'led-media-display',
      kind: 'enamel-sign',
      text: 'NEXUS AI — THE CITY THAT THINKS AHEAD',
      placement: 'full-colour LED media wall on the tower podium',
      texture: {
        path: 'textures/2025/led-media-display.svg',
        usage: 'High-brightness LED media wall with animated gradient bands.',
      },
      colors: {
        background: { r: 0.02, g: 0.04, b: 0.09 },
        foreground: { r: 0.2, g: 0.85, b: 1.0 },
      },
    },
    {
      id: 'holographic-panel',
      kind: 'enamel-sign',
      text: 'AURORA SKYLINE — VIRTUAL TOURS · BOOK NOW',
      placement: 'holographic-style projection panel above the plaza',
      texture: {
        path: 'textures/2025/holographic-panel.svg',
        usage: 'Holographic-style projection panel with translucent cyan text.',
      },
      colors: {
        background: { r: 0.04, g: 0.1, b: 0.14 },
        foreground: { r: 0.35, g: 0.95, b: 1.0 },
      },
    },
    {
      id: 'qr-vinyl',
      kind: 'painted-masonry',
      text: 'SCAN TO ORDER — QR DELIVERY AT THE CORNER',
      placement: 'QR-code vinyl wrap on the dead wall of the co-working block',
      texture: {
        path: 'textures/2025/qr-vinyl.svg',
        usage: 'QR-code vinyl wrap with a bold scan-me callout.',
      },
      colors: {
        background: { r: 0.95, g: 0.96, b: 0.98 },
        foreground: { r: 0.06, g: 0.08, b: 0.1 },
      },
    },
    {
      id: 'led-billboard',
      kind: 'enamel-sign',
      text: 'VOLT RIDE — SHARE · CHARGE · GO GREEN',
      placement: 'wall-mounted LED billboard on the glass tower',
      texture: {
        path: 'textures/2025/led-billboard.svg',
        usage: 'Wall-mounted LED billboard with teal and white type.',
      },
      colors: {
        background: { r: 0.02, g: 0.08, b: 0.09 },
        foreground: { r: 0.3, g: 0.95, b: 0.85 },
      },
    },
    {
      id: 'digital-bus-ad',
      kind: 'enamel-sign',
      text: 'CITY AIR INDEX 12 — CLEAN AIR DAY',
      placement: 'digital display on the bus-stop shelter',
      texture: {
        path: 'textures/2025/digital-bus-stop.svg',
        usage: 'Digital bus-stop display showing arrivals and the air-quality index.',
      },
      colors: {
        background: { r: 0.05, g: 0.08, b: 0.1 },
        foreground: { r: 0.5, g: 0.95, b: 0.6 },
      },
    },
  ],

  props: [
    {
      id: 'smart-bollard',
      kind: 'smart-bollard',
      count: 6,
      note: 'LED-ring smart bollards that pulse blue while a chargepoint is in use.',
    },
    {
      id: 'ev-charger',
      kind: 'ev-charger',
      count: 4,
      texture: {
        path: 'textures/2025/ev-charger.svg',
        usage: 'Fast-charge pedestal with a status ring and cable hook.',
      },
      note: 'Fast-charge pedestals with a status ring and a retractable cable.',
    },
    {
      id: 'cargo-bike-rack',
      kind: 'cargo-bike-rack',
      count: 2,
      note: 'Wide-wheel racks locking cargo e-bikes at the co-working entrance.',
    },
    {
      id: 'parklet',
      kind: 'parklet',
      count: 2,
      note: 'Curbside parklet with planters, bench seating, and a bike pump.',
    },
    {
      id: 'planter',
      kind: 'planter',
      count: 6,
      note: 'Steel-and-concrete planters with native grasses along the sidewalk.',
    },
    {
      id: 'digital-bus-stop',
      kind: 'digital-bus-stop',
      count: 2,
      texture: {
        path: 'textures/2025/digital-bus-stop.svg',
        usage: 'Digital arrivals display on the glass bus-stop shelter.',
      },
      note: 'Glass shelter with a live arrivals display and a USB charge port.',
    },
    {
      id: 'rooftop-hvac',
      kind: 'rooftop-hvac',
      count: 3,
      note: 'Screened rooftop HVAC units beside the solar arrays.',
    },
    {
      id: 'led-streetlight',
      kind: 'led-streetlight',
      count: 4,
      note: 'Slim LED streetlights with a clean white beam and a cctv node.',
    },
    {
      id: 'traffic-light',
      kind: 'traffic-light',
      count: 2,
      note: 'Modern LED traffic signal with a countdown pedestrian phase.',
    },
  ],

  pedestrians: {
    totalCount: 18,
    outfits: [
      {
        id: 'athleisure',
        name: 'Athleisure Set',
        category: 'civilian',
        palette: [
          { r: 0.18, g: 0.2, b: 0.26 },
          { r: 0.55, g: 0.6, b: 0.65 },
          { r: 0.9, g: 0.92, b: 0.95 },
        ],
        note: 'Oversized hoodie, leggings, and chunky running shoes on the way to a class.',
      },
      {
        id: 'tech-wear',
        name: 'Tech-Wear Shell',
        category: 'civilian',
        palette: [
          { r: 0.12, g: 0.14, b: 0.17 },
          { r: 0.4, g: 0.48, b: 0.55 },
          { r: 0.72, g: 0.78, b: 0.82 },
        ],
        note: 'Technical shell jacket with cargo joggers and a crossbody sling.',
      },
      {
        id: 'wireless-earbuds',
        name: 'Wireless Earbuds Commuter',
        category: 'civilian',
        palette: [
          { r: 0.3, g: 0.34, b: 0.4 },
          { r: 0.85, g: 0.87, b: 0.9 },
          { r: 0.14, g: 0.5, b: 0.46 },
        ],
        note: 'Smart-casual commuter with wireless earbuds in and a podcast visibly playing.',
      },
      {
        id: 'backpack-laptop',
        name: 'Backpack & Laptop',
        category: 'civilian',
        palette: [
          { r: 0.16, g: 0.18, b: 0.22 },
          { r: 0.5, g: 0.42, b: 0.3 },
          { r: 0.95, g: 0.96, b: 0.98 },
        ],
        note: 'Puffer vest, roll-top backpack, and a laptop sleeve under one arm.',
      },
      {
        id: 'coffee-run',
        name: 'Coffee Run',
        category: 'civilian',
        palette: [
          { r: 0.62, g: 0.52, b: 0.4 },
          { r: 0.2, g: 0.22, b: 0.26 },
          { r: 0.88, g: 0.9, b: 0.92 },
        ],
        note: 'Cradles an oat-milk latte in a kraft cup with a sleeve, phone in the other hand.',
      },
      {
        id: 'phone-out',
        name: 'Phone-Out Walker',
        category: 'civilian',
        palette: [
          { r: 0.24, g: 0.28, b: 0.34 },
          { r: 0.7, g: 0.72, b: 0.76 },
          { r: 0.1, g: 0.12, b: 0.16 },
        ],
        note: 'Scrolling while walking, thumb-swiping past the QR vinyl without looking up.',
      },
      {
        id: 'delivery-rider',
        name: 'Delivery Rider',
        category: 'uniformed',
        palette: [
          { r: 0.95, g: 0.4, b: 0.1 },
          { r: 0.1, g: 0.12, b: 0.14 },
          { r: 0.9, g: 0.92, b: 0.94 },
        ],
        note: 'Hi-vis courier jacket and helmet locking a cargo e-bike outside the coffee shop.',
      },
      {
        id: 'barista',
        name: 'Café Barista',
        category: 'uniformed',
        palette: [
          { r: 0.08, g: 0.09, b: 0.1 },
          { r: 0.62, g: 0.5, b: 0.34 },
          { r: 0.95, g: 0.96, b: 0.98 },
        ],
        note: 'Black apron and cap, taking a phone order on the pavement between pulls.',
      },
    ],
  },

  audio: {
    trafficProfile: 'quiet — sparse EV whir and tyre hiss, the occasional e-scooter pass, and a distant drone; far fewer combustion engines',
    eventChancePerMinute: 1.6,
    musicStyle: 'lofi and indie drifting from the coffee shop and co-working lobby',
    cues: [
      {
        path: '2025/ev-hum.wav',
        category: 'ambient',
        purpose: 'Quiet EV street hum and clean-air ambience for the smart-city block.',
      },
      {
        path: '2025/cafe-chatter.wav',
        category: 'ambient',
        purpose: 'Specialty coffee shop chatter and espresso-machine hiss bleeding onto the sidewalk.',
      },
      {
        path: '2025/traffic-electric.wav',
        category: 'traffic',
        purpose: 'Sparse electric traffic loop: EV whir and tyre hiss with no engine rumble.',
      },
      {
        path: '2025/e-scooter-whir.wav',
        category: 'event',
        purpose: 'E-scooter pass-by whir one-shot.',
      },
      {
        path: '2025/drone-whir.wav',
        category: 'event',
        purpose: 'Delivery drone overhead whir one-shot.',
      },
      {
        path: '2025/lofi-radio.wav',
        category: 'radio',
        purpose: 'Lofi playlist drifting from the coffee shop speakers.',
      },
    ],
  },

  camera: {
    id: '2025-glass-canyon',
    label: 'Glass Canyon at Golden Hour',
    position: { x: 7.4, y: 4.6, z: 12.4 },
    target: { x: -1.4, y: 3.8, z: 0.2 },
    fov: 55,
  },
};

export default era2025;