/**
 * The five-era dataset. A plain, serializable `Record<Year, EraDefinition>`
 * that is the single source of truth for every visual and aural detail of a
 * timeline stop. No runtime dependencies, no DOM, no Three.js.
 */
import type { EraDefinition, Year } from './types';

/** Ordered list of era years, mirroring {@link Year}. */
export const ERA_YEARS: readonly Year[] = [1945, 1965, 1985, 2005, 2025];

/**
 * Researched-feeling descriptions of each of the five timeline stops.
 * Indexed by year so downstream code can look up an era in O(1).
 */
export const ERAS: Record<Year, EraDefinition> = {
  1945: {
    label: 'Post-war recovery',
    palette: {
      ground: '#4a5a3c',
      road: '#3b3b40',
      sidewalk: '#8a8276',
      buildingPrimary: '#9b4a32',
      buildingSecondary: '#6b4028',
      accent: '#c8a24a',
      foliage: '#3f5a2e',
    },
    skyTint: '#b8a890',
    sunIntensity: 1.1,
    fog: { color: '#b8a890', near: 35, far: 120 },
    buildingStyles: [
      {
        name: 'War-damaged brick tenement',
        material: 'red-brick',
        heightRange: [4, 7],
        facade: 'Sooty red brick with boarded windows and patched masonry',
        roofline: 'Flat tar-paper with brick parapets',
      },
      {
        name: 'Art Deco office block',
        material: 'limestone',
        heightRange: [8, 14],
        facade: 'Polished limestone piers with brass-framed sash windows',
        roofline: 'Stepped ziggurat crown',
      },
    ],
    vehicleSet: [
      {
        name: 'Birchwood overhead tram',
        type: 'tram',
        powertrain: 'electric-overhead',
        silhouette: 'Wooden-bodied single-deck car on steel bogies',
      },
      {
        name: 'Ford V8 sedan',
        type: 'sedan',
        powertrain: 'petrol',
        silhouette: 'Rounded fenders, running boards, chrome grille',
      },
      {
        name: 'GM "fishbowl" bus',
        type: 'bus',
        powertrain: 'diesel',
        silhouette: 'High-floor coach with riveted aluminum body',
      },
    ],
    pedestrianWardrobe: [
      {
        name: 'Factory worker',
        silhouette: 'Slim overall-clad figure with flat cap',
        palette: ['#5b6470', '#7a6a4a', '#3a3f48'],
        accessories: ['cloth cap', 'lunch pail'],
      },
      {
        name: 'Nurse',
        silhouette: 'Caped uniform with starched headdress',
        palette: ['#d8d8e0', '#b04a4a'],
        accessories: ['shoulder bag'],
      },
    ],
    signageStyles: [
      {
        medium: 'painted',
        content: 'Hand-lettered shopfronts and war-bond posters',
        illumination: 'none',
      },
      {
        medium: 'incandescent',
        content: 'Bulb-outline theatre marquee',
        illumination: 'self-emissive',
      },
    ],
    audioTags: ['tram-bell', 'factory-whistle', 'radio-static', 'brass-band'],
  },

  1965: {
    label: 'Mid-century optimism',
    palette: {
      ground: '#56624a',
      road: '#3a3a3f',
      sidewalk: '#9a9a9e',
      buildingPrimary: '#c4c8cc',
      buildingSecondary: '#4a6a8a',
      accent: '#e04a6a',
      foliage: '#4a6a3a',
    },
    skyTint: '#8ab8d8',
    sunIntensity: 1.35,
    fog: { color: '#8ab8d8', near: 45, far: 160 },
    buildingStyles: [
      {
        name: 'International-style slab',
        material: 'reinforced-concrete',
        heightRange: [10, 24],
        facade: 'White concrete grid with ribbon windows',
        roofline: 'Flat with rooftop plant room',
      },
      {
        name: 'Brutalist civic block',
        material: 'reinforced-concrete',
        heightRange: [6, 12],
        facade: 'Board-marked béton brut with deep sun bays',
        roofline: 'Cantilevered service deck',
      },
    ],
    vehicleSet: [
      {
        name: 'Chevy Bel Air',
        type: 'sedan',
        powertrain: 'petrol',
        silhouette: 'Chrome tailfins, two-tone paint, whitewall tyres',
      },
      {
        name: 'VW Type 2 van',
        type: 'delivery-van',
        powertrain: 'petrol',
        silhouette: 'Split-screen bread-loaf microbus',
      },
      {
        name: 'PCC streetcar',
        type: 'streetcar',
        powertrain: 'electric-overhead',
        silhouette: 'Streamlined single-ended car with cowcatcher',
      },
    ],
    pedestrianWardrobe: [
      {
        name: 'Mods in parka',
        silhouette: 'Slim lapelled figure with fishtail parka',
        palette: ['#2a2a2a', '#6a4a3a', '#d8d8d0'],
        accessories: ['scooter helmet', 'vinyl record'],
      },
      {
        name: 'Shift-dress secretary',
        silhouette: 'A-line dress with beehive hair',
        palette: ['#d04a5a', '#e0c06a', '#4a6a8a'],
        accessories: ['cat-eye glasses'],
      },
    ],
    signageStyles: [
      {
        medium: 'neon',
        content: 'Diner and motel neon tubing, starburst motifs',
        illumination: 'self-emissive',
      },
      {
        medium: 'fluorescent',
        content: 'Backlit plastic channel letters',
        illumination: 'back-lit',
      },
    ],
    audioTags: ['neon-hum', 'surf-guitar', 'scooter-engine', 'jet-flyover'],
  },

  1985: {
    label: 'Boom-era metropolis',
    palette: {
      ground: '#4a524a',
      road: '#2e2e34',
      sidewalk: '#9a9aa0',
      buildingPrimary: '#6a7a86',
      buildingSecondary: '#3aa0c0',
      accent: '#e0e000',
      foliage: '#3a6a3a',
    },
    skyTint: '#7aa0c8',
    sunIntensity: 1.2,
    fog: { color: '#9aa0b0', near: 40, far: 180 },
    buildingStyles: [
      {
        name: 'Reflective glass tower',
        material: 'glass-curtain-wall',
        heightRange: [20, 50],
        facade: 'Mirrored blue-glass curtain wall with mullion grid',
        roofline: 'Flat with rooftop HVAC units',
      },
      {
        name: 'Postmodern pastiche',
        material: 'reinforced-concrete',
        heightRange: [8, 16],
        facade: 'Pink granite cladding with decorative classical motifs',
        roofline: 'Pedimented crown',
      },
    ],
    vehicleSet: [
      {
        name: 'DeLorean DMC-12',
        type: 'sedan',
        powertrain: 'petrol',
        silhouette: 'Brushed-steel wedge with gull-wing doors',
      },
      {
        name: 'Ford Bronco',
        type: 'suv',
        powertrain: 'petrol',
        silhouette: 'Boxy two-tone 4x4 with steel wheels',
      },
      {
        name: 'Neoplan articulated bus',
        type: 'bus',
        powertrain: 'diesel',
        silhouette: 'Bendy bus with accordion midsection',
      },
    ],
    pedestrianWardrobe: [
      {
        name: 'Power-suited banker',
        silhouette: 'Broad-shouldered double-breasted suit',
        palette: ['#1a1a2a', '#6a6a7a', '#8a1a1a'],
        accessories: ['briefcase', 'brick phone'],
      },
      {
        name: 'Breakdancer',
        silhouette: 'Tracksuit and high-top sneakers',
        palette: ['#e04a8a', '#4ac0e0', '#1a1a1a'],
        accessories: ['boombox', 'cardboard mat'],
      },
    ],
    signageStyles: [
      {
        medium: 'neon',
        content: 'Video-arcade marquees and movie hoardings',
        illumination: 'self-emissive',
      },
      {
        medium: 'crt',
        content: 'Stock-ticker and arrival/departure boards',
        illumination: 'self-emissive',
      },
    ],
    audioTags: ['arcade-blips', 'synth-bass', 'brick-phone-ring', 'saxophone'],
  },

  2005: {
    label: 'Globalised millennium',
    palette: {
      ground: '#52584e',
      road: '#2a2a2e',
      sidewalk: '#a0a0a4',
      buildingPrimary: '#8a8e94',
      buildingSecondary: '#4a9aca',
      accent: '#2ac0a0',
      foliage: '#3a7a4a',
    },
    skyTint: '#a0c4d8',
    sunIntensity: 1.3,
    fog: { color: '#c0c8d0', near: 50, far: 220 },
    buildingStyles: [
      {
        name: 'Steel-framed curtain-wall spire',
        material: 'structural-steel',
        heightRange: [30, 70],
        facade: 'Steel megaframe with double-skin fritted glass',
        roofline: 'Tapered spire with aviation beacon',
      },
      {
        name: 'Loft conversion warehouse',
        material: 'red-brick',
        heightRange: [5, 9],
        facade: 'Converted brick warehouse with steel-framed factory windows',
        roofline: 'Flat with rooftop terraces',
      },
    ],
    vehicleSet: [
      {
        name: 'Hummer H2',
        type: 'suv',
        powertrain: 'petrol',
        silhouette: 'Oversized chrome SUV on oversized wheels',
      },
      {
        name: 'Toyota Prius',
        type: 'sedan',
        powertrain: 'hybrid',
        silhouette: 'Aerodynamic wedge with low grille',
      },
      {
        name: 'Mercedes Sprinter van',
        type: 'delivery-van',
        powertrain: 'diesel',
        silhouette: 'Tall box van with sliding side door',
      },
    ],
    pedestrianWardrobe: [
      {
        name: 'Low-rise jeans teen',
        silhouette: 'Bootcut denim with crop top and flip phone',
        palette: ['#6a8aca', '#e0a0a0', '#3a3a3a'],
        accessories: ['iPod', 'messenger bag'],
      },
      {
        name: 'Cargo-shorts commuter',
        silhouette: 'Polo shirt with khaki cargo shorts',
        palette: ['#3a6a4a', '#8a7a5a', '#e0e0e0'],
        accessories: ['Bluetooth earpiece'],
      },
    ],
    signageStyles: [
      {
        medium: 'lcd-screen',
        content: 'Rolling news tickers and billboards',
        illumination: 'self-emissive',
      },
      {
        medium: 'led-array',
        content: 'Full-motion digital billboard',
        illumination: 'self-emissive',
      },
    ],
    audioTags: ['ringtone-polyphonic', 'hybrid-engine', 'ringback-tone', 'pop-punk'],
  },

  2025: {
    label: 'Sensor-driven present',
    palette: {
      ground: '#566056',
      road: '#26262a',
      sidewalk: '#a6a6aa',
      buildingPrimary: '#9aa0a6',
      buildingSecondary: '#2acaff',
      accent: '#ff3a8a',
      foliage: '#3a8a4a',
    },
    skyTint: '#b0d4e8',
    sunIntensity: 1.4,
    fog: { color: '#c8d0d8', near: 60, far: 260 },
    buildingStyles: [
      {
        name: 'Smart-glass eco-tower',
        material: 'smart-glass',
        heightRange: [40, 90],
        facade: 'Electrochromic smart-glass facade with vertical greenery',
        roofline: 'Curved crown with wind turbines',
      },
      {
        name: 'Cross-laminated timber block',
        material: 'reinforced-concrete',
        heightRange: [8, 18],
        facade: 'CLT panels with photovoltaic spandrels',
        roofline: 'Sawtooth solar canopy',
      },
    ],
    vehicleSet: [
      {
        name: 'Delivery quadcopter',
        type: 'drone',
        powertrain: 'battery-electric',
        silhouette: 'Quadcopter with underslung parcel pod',
      },
      {
        name: 'Tesla Model Y',
        type: 'suv',
        powertrain: 'battery-electric',
        silhouette: 'Seamless glass canopy with flush door handles',
      },
      {
        name: 'Autonomous robotaxi',
        type: 'sedan',
        powertrain: 'battery-electric',
        silhouette: 'Symmetric pod with LiDAR turret and no steering wheel',
      },
    ],
    pedestrianWardrobe: [
      {
        name: 'Athleisure commuter',
        silhouette: 'Joggers and technical hoodie with wireless buds',
        palette: ['#1a1a1a', '#2acaff', '#8a8a90'],
        accessories: ['smartwatch', 'backpack'],
      },
      {
        name: 'E-scooter rider',
        silhouette: 'Helmet and puffer jacket on kick scooter',
        palette: ['#e04a4a', '#1a1a2a', '#3a3a3a'],
        accessories: ['rental scooter', 'phone-mount'],
      },
    ],
    signageStyles: [
      {
        medium: 'led-array',
        content: 'Programmatic addressable LED mesh wrapping towers',
        illumination: 'self-emissive',
      },
      {
        medium: 'holographic',
        content: 'Floating volumetric product holograms',
        illumination: 'self-emissive',
      },
    ],
    audioTags: ['drone-buzz', 'ev-motor-whine', 'notification-chime', 'lo-fi-beat'],
  },
};
