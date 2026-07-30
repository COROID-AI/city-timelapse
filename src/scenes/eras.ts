export interface EraData {
  year: number;
  buildingArchitecturalStyle: string;
  vehicleFleet: string;
  storefrontPalette: string;
  adStyle: string;
  pedestrianOutfitPalette: string;
  colorGradingLUT: string;
  ambientSoundProfile: string;
  fog: string;
  timeOfDay: string;
}

export const timeline: EraData[] = [
  {
    year: 1945,
    buildingArchitecturalStyle: "Art Deco, brick and limestone facades, narrow windows",
    vehicleFleet: "Streetcars, early sedans, trams",
    storefrontPalette: "Muted pastels, hand-painted signage, warm neon",
    adStyle: "Art Deco posters, serif typography, foil-stamped logos",
    pedestrianOutfitPalette: "Tailored wool suits, hats, trench coats, ankle boots",
    colorGradingLUT: "Desaturated sepia with warm shadows",
    ambientSoundProfile: "Tram clatter, distant radio static, wind through narrow streets",
    fog: "Thick low fog with coal-smoke haze",
    timeOfDay: "Late afternoon golden hour",
  },
  {
    year: 1965,
    buildingArchitecturalStyle: "Mid-century modern, glass curtain walls, reinforced concrete",
    vehicleFleet: "Muscle cars, convertibles, diesel buses",
    storefrontPalette: "Bold primary colors, glossy surfaces, plastic signage",
    adStyle: "Psychedelic illustrations, sans-serif headlines, pop-art layouts",
    pedestrianOutfitPalette: "Mod silhouettes, go-go boots, polyester blends, wide collars",
    colorGradingLUT: "Warm high-contrast with boosted reds and oranges",
    ambientSoundProfile: "Rockabilly on AM radio, motorcycle engines, sidewalk chatter",
    fog: "Light atmospheric haze in warm amber tones",
    timeOfDay: "Sunset with deep amber sky",
  },
  {
    year: 1985,
    buildingArchitecturalStyle: "Postmodern, geometric facades, exposed steel, neon cladding",
    vehicleFleet: "Sedan sedans, early SUVs, VHS-era delivery vans",
    storefrontPalette: "Neon blues, magentas, and greens, chrome accents, LED edge-lighting",
    adStyle: "Synthwave typography, chrome gradients, grid overlays, airbrush graphics",
    pedestrianOutfitPalette: "Bright acid-wash denim, oversized blazers, sneakers, neon accents",
    colorGradingLUT: "Teal-and-orange cinematic grade with crushed blacks",
    ambientSoundProfile: "Synthwave pads, cassette deck hiss, car alarms, distant bass",
    fog: "Diffuse volumetric fog tinted with neon spill",
    timeOfDay: "Twilight neon bloom, blue hour",
  },
  {
    year: 2005,
    buildingArchitecturalStyle: "Eco-glass towers, mixed-use blocks, brushed aluminum cladding",
    vehicleFleet: "Hybrid sedans, SUVs, delivery trucks, early ride-share cars",
    storefrontPalette: "Clean whites, brushed steel, LCD menu boards, soft warm LEDs",
    adStyle: "Minimalist sans-serif, high-res photography, social-media ad frames",
    pedestrianOutfitPalette: "Smart casual, layered knits, canvas sneakers, low-key branding",
    colorGradingLUT: "Balanced neutral grade with slight warmth, clean highlights",
    ambientSoundProfile: "Café murmurs, hybrid car hum, notification pings, crowd ambient",
    fog: "Thin urban haze with warm sodium-vapor glow",
    timeOfDay: "Overcast midday with soft diffusion",
  },
  {
    year: 2025,
    buildingArchitecturalStyle: "Adaptive reuse, parametric facades, living green walls, smart glass",
    vehicleFleet: "EV sedans, autonomous delivery bots, e-bikes, ride-share fleet",
    storefrontPalette: "OLED blacks, adaptive RGB lighting, sustainable timber, holographic displays",
    adStyle: "Dynamic personalized overlays, AR interfaces, micro-interaction design",
    pedestrianOutfitPalette: "Techwear layers, muted earth tones, reflective accents, ergonomic footwear",
    colorGradingLUT: "Cool neutral grade with subtle cyan highlights and fine grain",
    ambientSoundProfile: "Electric drivetrain hum, drone overhead, ambient digital chimes",
    fog: "Clean low mist with cool blue undertone",
    timeOfDay: "Clear noon with sharp shadows",
  },
  {
    year: 2055,
    buildingArchitecturalStyle: "Bio-architecture, self-healing concrete, floating sky gardens, 3D-printed forms",
    vehicleFleet: "Autonomous sky-taxis, cargo drones, magnetic rail pods, shared mobility pods",
    storefrontPalette: "Holographic gradients, adaptive materials, ambient projection, chromatic surfaces",
    adStyle: "Volumetric holograms, AI-generated personalized displays, spatial computing UI",
    pedestrianOutfitPalette: "Adaptive smart-fabric, chromatic shift materials, sustainable bio-synthetics",
    colorGradingLUT: "Wide-gamut cinematic grade with cool violet highlights and filmic grain",
    ambientSoundProfile: "Wind at altitude, drone traffic hum, distant rail mag-lev, layered nature ambience",
    fog: "Luminous pearlescent fog with slow-drifting particulate",
    timeOfDay: "High sun with thin cirrus cloud streaks",
  },
];

// Named export used by final evidence checks.
// The project’s "timeline" is the authoritative era list.
export type TimelineConfig = EraData[];
export const TimelineConfig: TimelineConfig = timeline;

export default timeline;
