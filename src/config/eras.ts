import type { EraIndex, EraVisualConfig } from "../types";

export const ERAS: readonly EraVisualConfig[] = [
  {
    year: 1945,
    name: "Postwar Awakening",
    tagline: "Rebuilding the block, brick by brick.",
    sky: 0xcab78f,
    fog: 0xc4b190,
    fogNear: 28,
    fogFar: 120,
    sunColor: 0xffd29a,
    sunIntensity: 1.15,
    sunPos: { x: -34, y: 20, z: 16 },
    sunShadowFar: 130,
    ambientColor: 0x6b5d49,
    ambientIntensity: 0.55,
    hemiSky: 0xb6a47e,
    hemiGround: 0x46392b,
    hemiIntensity: 0.6,
    groundColor: 0x52432f,
    roadColor: 0x4a4036,
    sidewalkColor: 0x988a70,
    buildingColors: [0x8a6a46, 0x7a5836, 0x6a4c30, 0x9a7850, 0x5e4630],
    accent: 0xffcf8a,
    vehicleColors: [0x2a1f1a, 0x3a2e22, 0x5a4632, 0x1a1410, 0x46362a],
    pedestrianColors: [0x3a352a, 0x4a4030, 0x2e2a22, 0x55493a, 0x6b5a45],
    density: 0.55,
    buildingFloorsMin: 2,
    buildingFloorsMax: 5,
    mood: "Warm sepia haze · low, humble rooflines",
    facts: {
      buildings:
        "Walk-up brownstones and brick tenements of two to five floors line the street.",
      vehicles:
        "Curvy pre-war sedans with bulbous fenders and chrome bumpers idle past.",
      pedestrians:
        "Men in fedoras and overcoats, women in modest A-line dresses, wartime thrift still felt.",
      props:
        "Cast-iron streetlamps with glass globes, plus the occasional fire-escape ladder.",
      signage:
        "Hand-painted shop signs advertise bread, tailor services, and the local cinema.",
    },
  },
  {
    year: 1965,
    name: "Mid-Century Boom",
    tagline: "Pastel optimism and tail fins.",
    sky: 0xa2c8e4,
    fog: 0xb9cad8,
    fogNear: 34,
    fogFar: 140,
    sunColor: 0xfff0d0,
    sunIntensity: 1.3,
    sunPos: { x: 22, y: 30, z: 14 },
    sunShadowFar: 150,
    ambientColor: 0x556070,
    ambientIntensity: 0.55,
    hemiSky: 0x8fb4d4,
    hemiGround: 0x4a4438,
    hemiIntensity: 0.7,
    groundColor: 0x4c4c3a,
    roadColor: 0x36363a,
    sidewalkColor: 0x9aa0a0,
    buildingColors: [0xc2b8a6, 0xa8a8a0, 0xcdb492, 0x9aa0a8, 0xb09890],
    accent: 0xff8a5a,
    vehicleColors: [0xb03030, 0x3040b0, 0xc6a020, 0xd0d0d0, 0x205040],
    pedestrianColors: [0xd04040, 0x4060c0, 0xe0b030, 0x50a060, 0xc060a0],
    density: 0.8,
    buildingFloorsMin: 3,
    buildingFloorsMax: 7,
    mood: "Crisp blue sky · concrete slab towers and pastel awnings",
    facts: {
      buildings:
        "Concrete-slab apartment blocks and glass storefronts rise five to seven floors.",
      vehicles:
        "Two-tone land yachts with chrome tail fins and whitewall tires roll by.",
      pedestrians:
        "Mods in bright minidresses and slim suits; bouffant hair and bold colors.",
      props:
        "Gooseneck streetlamps, barber poles, and striped canvas awnings shade the walk.",
      signage:
        "Bold sans-serif signs plug diners, drive-ins, and the newest transistor radios.",
    },
  },
  {
    year: 1985,
    name: "Neon Grit",
    tagline: "Smog, synthwave, and arcades.",
    sky: 0x4a3a5e,
    fog: 0x5a4a6e,
    fogNear: 24,
    fogFar: 105,
    sunColor: 0xff9a6a,
    sunIntensity: 0.85,
    sunPos: { x: 40, y: 12, z: -12 },
    sunShadowFar: 130,
    ambientColor: 0x40304a,
    ambientIntensity: 0.6,
    hemiSky: 0x604070,
    hemiGround: 0x2a2030,
    hemiIntensity: 0.7,
    groundColor: 0x3a3340,
    roadColor: 0x2a2630,
    sidewalkColor: 0x6a6070,
    buildingColors: [0x4a4a55, 0x55606a, 0x3a3a45, 0x605060, 0x404858],
    accent: 0xff3a8a,
    vehicleColors: [0x8a3030, 0x303a5a, 0x5a5a3a, 0xaaaaaa, 0x2a2a2a],
    pedestrianColors: [0xff4090, 0x40d0ff, 0xffd040, 0x90ff60, 0xffffff],
    density: 1.1,
    buildingFloorsMin: 5,
    buildingFloorsMax: 11,
    mood: "Smoggy dusk · mirrored glass and glowing neon",
    facts: {
      buildings:
        "Mirrored-glass office slabs and grimy brick towers stack ten to twelve floors.",
      vehicles:
        "Boxy sedans with sealed-beam headlights and vinyl roofs creep through traffic.",
      pedestrians:
        "Shoulder pads, acid-wash denim, big hair, and windbreakers in neon tones.",
      props:
        "Chain-link, payphones, and buzzing fluorescent tubes light the haze.",
      signage:
        "Tube-neon signs blaze pink and cyan for video stores, arcades, and diners.",
    },
  },
  {
    year: 2005,
    name: "Digital Dawn",
    tagline: "Glass canyons and the early web.",
    sky: 0x6aa8e0,
    fog: 0xbcd0e0,
    fogNear: 40,
    fogFar: 160,
    sunColor: 0xfff8ee,
    sunIntensity: 1.35,
    sunPos: { x: -22, y: 32, z: 20 },
    sunShadowFar: 160,
    ambientColor: 0x607080,
    ambientIntensity: 0.6,
    hemiSky: 0x9ec2ea,
    hemiGround: 0x50503a,
    hemiIntensity: 0.8,
    groundColor: 0x4a5040,
    roadColor: 0x2e2e30,
    sidewalkColor: 0xa0a4a8,
    buildingColors: [0x6a8aa8, 0x88a0b8, 0x5a7090, 0x9aaabc, 0xb0b8c0],
    accent: 0x3aa0ff,
    vehicleColors: [0xb0b0b0, 0x202020, 0xa0a0a0, 0xc0202a, 0x1a3a5a, 0xf0f0f0],
    pedestrianColors: [0x3040a0, 0xa04020, 0x205050, 0x606060, 0xc0c0a0],
    density: 1.0,
    buildingFloorsMin: 8,
    buildingFloorsMax: 18,
    mood: "Bright clear day · curtain-wall towers and LED screens",
    facts: {
      buildings:
        "Curtain-wall skyscrapers of blue-tinted glass climb eighteen floors and higher.",
      vehicles:
        "Rounded SUVs and sedans in silver, black, and cherry red stream through.",
      pedestrians:
        "Low-rise denim, cargo pants, flip phones, and messenger bags dominate.",
      props:
        "Modern pole lamps, bike racks, and the first smart traffic signals appear.",
      signage:
        "LED billboards loop ads for phones, broadband, and coffee chains.",
    },
  },
  {
    year: 2025,
    name: "Green Renewal",
    tagline: "Quiet vehicles and living walls.",
    sky: 0x7cbadc,
    fog: 0xc4d8e2,
    fogNear: 44,
    fogFar: 165,
    sunColor: 0xfff4e0,
    sunIntensity: 1.3,
    sunPos: { x: 24, y: 32, z: -18 },
    sunShadowFar: 165,
    ambientColor: 0x506070,
    ambientIntensity: 0.62,
    hemiSky: 0xaad0ea,
    hemiGround: 0x46503a,
    hemiIntensity: 0.85,
    groundColor: 0x44604a,
    roadColor: 0x2c2c30,
    sidewalkColor: 0xaab0b0,
    buildingColors: [0x889098, 0x6a7878, 0x9aa0a0, 0x586860, 0xb0b8b0],
    accent: 0x40e0a0,
    vehicleColors: [0xf0f0f0, 0x202428, 0x1a2a3a, 0xdadada, 0x2a4030],
    pedestrianColors: [0x2a2a2a, 0xe0e0e0, 0x3a5a7a, 0x8a4a3a, 0x4a8060],
    density: 1.2,
    buildingFloorsMin: 7,
    buildingFloorsMax: 16,
    mood: "Fresh clear light · vegetated facades and electric mobility",
    facts: {
      buildings:
        "Sleek towers wear green walls and rooftop solar arrays, rising to sixteen floors.",
      vehicles:
        "Whisper-quiet electric cars and SUVs glide along, many in white and slate.",
      pedestrians:
        "Athleisure, puffer vests, earbuds, and reusable cups fill the sidewalks.",
      props:
        "Smart poles with sensors, e-scooter docks, and planted rain gardens line the curb.",
      signage:
        "Crisp digital screens promote sustainability, streaming, and delivery apps.",
    },
  },
  {
    year: 2055,
    name: "Neo Horizon",
    tagline: "Glowing megatowers and sky traffic.",
    sky: 0x12304a,
    fog: 0x1e3a55,
    fogNear: 30,
    fogFar: 140,
    sunColor: 0x66aaff,
    sunIntensity: 0.8,
    sunPos: { x: -40, y: 18, z: -22 },
    sunShadowFar: 150,
    ambientColor: 0x2a3a55,
    ambientIntensity: 0.7,
    hemiSky: 0x2a4a7a,
    hemiGround: 0x10202a,
    hemiIntensity: 0.95,
    groundColor: 0x20303a,
    roadColor: 0x161a22,
    sidewalkColor: 0x3a4a55,
    buildingColors: [0x2a3a4a, 0x34485a, 0x223040, 0x445566, 0x2e3a50],
    accent: 0x33ddff,
    vehicleColors: [0x1a2a3a, 0x2a3a4a, 0x101820, 0x3050a0, 0x44ccee],
    pedestrianColors: [0x4af0ff, 0xff4ad0, 0xaaffff, 0x40ffc0, 0xe0e0ff],
    density: 0.7,
    buildingFloorsMin: 14,
    buildingFloorsMax: 30,
    mood: "Twilight glow · vertical megatowers, drones, and holograms",
    facts: {
      buildings:
        "Vertical megatowers soar thirty floors, ribbed with cyan luminescent veins.",
      vehicles:
        "Hovering pods and autonomous drones thread the air above the silent road.",
      pedestrians:
        "Iridescent techwear, glowing accessories, and augmented visors drift by.",
      props:
        "Tall light-poles project holographic guidance; gardens glow with bioluminescence.",
      signage:
        "Holographic billboards flicker with AI concierges and off-world travel ads.",
    },
  },
] as const;

export const ERA_INDICES: readonly EraIndex[] = [0, 1, 2, 3, 4, 5];

/** Find the index for a given year (throws if missing — config invariant). */
export function eraIndexForYear(year: number): EraIndex {
  const i = ERAS.findIndex((e) => e.year === year);
  if (i < 0) throw new Error(`Unknown era year: ${year}`);
  return i as EraIndex;
}
