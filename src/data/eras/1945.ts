/**
 * 1945 era dataset — wartime / rebuilding city block.
 *
 * Post-war austerity: a dim overcast sky with muted sepia grading, coal-smoke
 * haze, brick low-rises with blackout shutters, bombsite rubble lots under
 * temporary shoring, gas lamps, ration-book posters, painted masonry wall
 * ads, enamel shop signs, a handful of 1940s civilian cars and military
 * jeeps/lorries, and pedestrians in wartime coats, hats, and uniforms.
 *
 * This file is DATA ONLY — subsystems construct geometry and materials FROM
 * it; no 3D geometry lives here. Texture paths resolve relative to
 * `src/assets/`, audio cue paths relative to `src/audio/`.
 */
import type { TimeEra } from '../../engine/eras';

export const era1945: TimeEra = {
  id: '1945',
  year: 1945,
  label: 'Post-War',
  description:
    'Wartime austerity: brick low-rises, bombsite rubble lots, gas lamps, and ration posters under a sepia coal-smoke sky.',

  environment: {
    timeOfDay: 'dusk',
    weather: 'dim overcast with a light coal-smoke haze',
    grading: 'muted-sepia',
    skyColor: { r: 0.42, g: 0.4, b: 0.37 },
    horizonColor: { r: 0.56, g: 0.48, b: 0.4 },
    fogColor: { r: 0.45, g: 0.42, b: 0.38 },
    fogStart: 10,
    fogEnd: 55,
    haze: {
      color: { r: 0.36, g: 0.33, b: 0.3 },
      density: 0.55,
      particleCount: 120,
    },
    streetlights: {
      color: { r: 1.0, g: 0.72, b: 0.42 },
      poolColor: { r: 0.95, g: 0.62, b: 0.35 },
      intensity: 0.9,
    },
    sun: {
      color: { r: 0.86, g: 0.78, b: 0.66 },
      intensity: 0.55,
      elevationDeg: 14,
      azimuthDeg: 208,
    },
    ambientIntensity: 0.42,
  },

  buildings: {
    style: 'interwar brick low-rise with blackout shutters',
    material: 'dirty red brick with soot-stained mortar',
    facadeTexture: {
      path: 'textures/1945/warm-brick.svg',
      usage: 'Repeated brickwork texture for low-rise facades.',
    },
    facadePalette: [
      { r: 0.52, g: 0.3, b: 0.22 },
      { r: 0.44, g: 0.26, b: 0.2 },
      { r: 0.58, g: 0.36, b: 0.24 },
    ],
    heightRange: [2.2, 4.6],
    windows: {
      color: { r: 1.0, g: 0.78, b: 0.42 },
      emissiveIntensity: 0.24,
      blackoutShutters: true,
      litFraction: 0.18,
      shutterTexture: {
        path: 'textures/1945/blackout-shutter.svg',
        usage: 'Dark slatted shutters drawn over unlit windows.',
      },
    },
    rubbleLots: {
      count: 3,
      texture: {
        path: 'textures/1945/rubble-lot.svg',
        usage: 'Bombsite rubble ground for empty lots between buildings.',
      },
      temporaryShoring: true,
    },
    rooftopProps: ['water-tower', 'chimney-stack', 'brick-parapet'],
  },

  vehicles: [
    {
      id: 'ford-eight',
      kind: 'civilian',
      modelName: '1930s saloon (Ford Eight)',
      count: 3,
      bodyPalette: [
        { r: 0.12, g: 0.11, b: 0.1 },
        { r: 0.13, g: 0.2, b: 0.13 },
        { r: 0.24, g: 0.1, b: 0.09 },
      ],
      speedRange: [2.2, 3.6],
      note: 'Blackout headlamp masks and a worn wartime paint finish.',
    },
    {
      id: 'austin-seven',
      kind: 'civilian',
      modelName: 'Austin 7',
      count: 2,
      bodyPalette: [
        { r: 0.18, g: 0.17, b: 0.16 },
        { r: 0.2, g: 0.16, b: 0.1 },
      ],
      speedRange: [1.8, 3.0],
      note: 'Utility grey; a pre-war runabout kept running through the war.',
    },
    {
      id: 'willys-jeep',
      kind: 'military',
      modelName: 'Willys MB jeep',
      count: 2,
      bodyPalette: [
        { r: 0.24, g: 0.26, b: 0.16 },
        { r: 0.3, g: 0.28, b: 0.18 },
      ],
      speedRange: [2.6, 4.2],
      note: 'Olive-drab reconnaissance jeep with canvas top.',
    },
    {
      id: 'bedford-lorry',
      kind: 'military',
      modelName: 'Bedford QL lorry',
      count: 1,
      bodyPalette: [{ r: 0.23, g: 0.25, b: 0.15 }],
      speedRange: [1.6, 2.4],
      note: 'Army 3-ton lorry delivering salvage and building timber.',
    },
  ],

  storefronts: [
    {
      id: 'butcher',
      kind: 'butcher',
      name: 'H. Lowe & Sons',
      sign: {
        material: 'painted-wood',
        text: 'H. LOWE BUTCHER',
        texture: {
          path: 'textures/1945/butcher-sign.svg',
          usage: 'Painted wooden sign above the butcher shop.',
        },
        background: { r: 0.54, g: 0.37, b: 0.22 },
        foreground: { r: 0.95, g: 0.9, b: 0.78 },
      },
      windowDisplay: 'Hanging poultry, ration-board notices, and a sawdust floor.',
    },
    {
      id: 'greengrocer',
      kind: 'greengrocer',
      name: 'Mercer Greengrocer',
      sign: {
        material: 'painted-wood',
        text: 'MERCER GREENGROCER',
        texture: {
          path: 'textures/1945/greengrocer-sign.svg',
          usage: 'Painted wooden sign above the greengrocer.',
        },
        background: { r: 0.91, g: 0.87, b: 0.78 },
        foreground: { r: 0.18, g: 0.36, b: 0.2 },
      },
      windowDisplay: 'Potatoes, cabbages, and a queue for the vegetable ration.',
    },
    {
      id: 'cobbler',
      kind: 'cobbler',
      name: 'J. Pike Boot Repair',
      sign: {
        material: 'painted-wood',
        text: 'J. PIKE COBBLER',
        texture: {
          path: 'textures/1945/cobbler-sign.svg',
          usage: 'Painted wooden sign above the cobbler.',
        },
        background: { r: 0.78, g: 0.66, b: 0.47 },
        foreground: { r: 0.23, g: 0.16, b: 0.1 },
      },
      windowDisplay: 'Repair bench, lasts, and a "Soles & Heels While-U-Wait" card.',
    },
    {
      id: 'newsstand',
      kind: 'newsstand',
      name: 'Corner News',
      sign: {
        material: 'painted-wood',
        text: 'NEWS & TOBACCO',
        texture: {
          path: 'textures/1945/newsstand-sign.svg',
          usage: 'Painted wooden sign on the corner newsstand.',
        },
        background: { r: 0.94, g: 0.92, b: 0.85 },
        foreground: { r: 0.55, g: 0.12, b: 0.12 },
      },
      windowDisplay: 'Piled newspapers, cigarette cards, and a "Wanted" notice board.',
    },
  ],

  advertisements: [
    {
      id: 'coal-ad',
      kind: 'painted-masonry',
      text: 'COAL & COKE — DELIVERED DAILY',
      placement: 'gable-end wall of the corner shop',
      texture: {
        path: 'textures/1945/coal-ad.svg',
        usage: 'Painted masonry wall advertisement.',
      },
      colors: {
        background: { r: 0.91, g: 0.86, b: 0.75 },
        foreground: { r: 0.23, g: 0.16, b: 0.1 },
      },
    },
    {
      id: 'war-bonds-ad',
      kind: 'painted-masonry',
      text: 'BUY WAR BONDS — FOR VICTORY',
      placement: 'hoarding around the bombsite lot',
      texture: {
        path: 'textures/1945/war-bonds-ad.svg',
        usage: 'Painted hoarding advertisement on the rubble-lot fence.',
      },
      colors: {
        background: { r: 0.85, g: 0.79, b: 0.64 },
        foreground: { r: 0.48, g: 0.12, b: 0.12 },
      },
    },
    {
      id: 'tea-ad',
      kind: 'enamel-sign',
      text: 'LYONS TEA',
      placement: 'shop fascia above the butcher',
      texture: {
        path: 'textures/1945/enamel-sign.svg',
        usage: 'Glossy enamel shop sign.',
      },
      colors: {
        background: { r: 0.91, g: 0.87, b: 0.78 },
        foreground: { r: 0.12, g: 0.23, b: 0.42 },
      },
    },
  ],

  props: [
    {
      id: 'gas-lamp',
      kind: 'gas-lamp',
      count: 6,
      note: 'Cast-iron gas lamps with warm flame pools along the kerb.',
    },
    {
      id: 'sandbags',
      kind: 'sandbag-stack',
      count: 4,
      texture: {
        path: 'textures/1945/sandbag.svg',
        usage: 'Stacked sandbags texture for shelter and shopfront protection.',
      },
      note: 'Piled outside the public shelter and the town hall steps.',
    },
    {
      id: 'ration-poster',
      kind: 'ration-poster',
      count: 3,
      texture: {
        path: 'textures/1945/ration-poster.svg',
        usage: 'Ration-book poster texture for walls and hoardings.',
      },
      note: 'Ration-book, salvage, and blackout notices on walls and hoardings.',
    },
    {
      id: 'bicycle-rack',
      kind: 'bicycle-rack',
      count: 2,
      note: 'Wartime bicycles locked at the kerb outside the newsstand.',
    },
    {
      id: 'wooden-barrel',
      kind: 'wooden-barrel',
      count: 3,
      note: 'Rain barrels and produce barrels by the greengrocer.',
    },
    {
      id: 'air-raid-sign',
      kind: 'air-raid-sign',
      count: 1,
      note: 'Public shelter direction sign bolted to the corner building.',
    },
  ],

  pedestrians: {
    totalCount: 7,
    outfits: [
      {
        id: 'wool-overcoat',
        name: 'Wool Overcoat & Trilby',
        category: 'civilian',
        palette: [
          { r: 0.22, g: 0.17, b: 0.13 },
          { r: 0.16, g: 0.16, b: 0.15 },
          { r: 0.2, g: 0.21, b: 0.16 },
        ],
        note: 'Utility-cut civilian coat with a felt hat and a rationed suit.',
      },
      {
        id: 'utility-dress',
        name: 'Utility Dress & Headscarf',
        category: 'civilian',
        palette: [
          { r: 0.5, g: 0.35, b: 0.3 },
          { r: 0.18, g: 0.22, b: 0.32 },
        ],
        note: 'CC41 utility dress with a turban or headscarf.',
      },
      {
        id: 'army-uniform',
        name: 'Army Service Uniform',
        category: 'uniformed',
        palette: [
          { r: 0.3, g: 0.31, b: 0.2 },
          { r: 0.22, g: 0.18, b: 0.12 },
        ],
        note: 'Khaki battle dress with a beret and webbing.',
      },
      {
        id: 'navy-uniform',
        name: 'Navy Rating',
        category: 'uniformed',
        palette: [
          { r: 0.09, g: 0.12, b: 0.2 },
          { r: 0.85, g: 0.85, b: 0.82 },
        ],
        note: 'Sailor collar and bell-bottom trousers.',
      },
      {
        id: 'postman',
        name: 'Postman',
        category: 'uniformed',
        palette: [
          { r: 0.13, g: 0.2, b: 0.3 },
          { r: 0.3, g: 0.3, b: 0.3 },
        ],
        note: 'GPO uniform with a peaked cap and mailbag.',
      },
    ],
  },

  audio: {
    trafficProfile: 'sparse — a civilian saloon, a jeep, or a lorry every few minutes',
    eventChancePerMinute: 1.6,
    musicStyle: 'wartime radio: swing band, news bulletins, and static',
    cues: [
      {
        path: '1945/ambient-hum.wav',
        category: 'ambient',
        purpose: 'Coal-smoke room tone and distant city hum.',
      },
      {
        path: '1945/tram-bell.wav',
        category: 'event',
        purpose: 'Distant tram bell one-shot.',
      },
      {
        path: '1945/traffic-sparse.wav',
        category: 'traffic',
        purpose: 'Sparse engine rumble loop bed.',
      },
      {
        path: '1945/radio-chatter.wav',
        category: 'radio',
        purpose: 'Wartime radio chatter and swing music bed.',
      },
    ],
  },

  camera: {
    id: '1945-street-corner',
    label: 'Street Corner at Dusk',
    position: { x: 3.4, y: 2.1, z: 7.6 },
    target: { x: -0.4, y: 1.5, z: 0.2 },
    fov: 58,
  },
};

export default era1945;