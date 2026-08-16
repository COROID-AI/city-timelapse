// ─── Inspection Copy Library ──────────────────────────────────────
// Era-specific descriptive copy for clickable scene objects.
// All copy is invented, generic, and free of trademarks.
// Keyed by EraId × objectType for precise lookup.

import type { EraId } from '../eras.js';

/** Categories of inspectable objects in the scene */
export type InspectObjectType =
  | 'building'
  | 'storefront'
  | 'billboard'
  | 'wall-ad'
  | 'vehicle'
  | 'pedestrian';

/** Single copy entry for one era × object-type pair */
interface CopyEntry {
  title: string;
  description: string;
}

/** Full copy map — every EraId × InspectObjectType must have an entry */
const INSPECTION_COPY: Record<EraId, Record<InspectObjectType, CopyEntry>> = {
  // ════════════════════════════════════════════════════
  // 1945 — World War II Era
  // ════════════════════════════════════════════════════
  '1945': {
    building: {
      title: 'Wartime Utility Block',
      description:
        'A sturdy brick structure built for function over form. Sandbags line the ground floor windows and blackout curtains hang behind every pane. A water tower perched on the flat roof holds emergency reserves — everyday life continues steadily beneath the shadow of global conflict.',
    },
    storefront: {
      title: 'Corner Ration Shop',
      description:
        'The narrow shop window displays tins of preserved goods and hand-stamped ration books. A faded "Open" sign hangs crookedly above the door, and the owner peers out through the crack in the blackout drapes, ever watchful.',
    },
    billboard: {
      title: 'Victory Garden Banner',
      description:
        'Painted directly onto the building façade, this poster urges citizens to grow their own vegetables and save precious metal for the war effort. Faded sun-bleached colors hint at months of exposure to the elements.',
    },
    'wall-ad': {
      title: 'War Bonds Notice',
      description:
        'A hand-painted mural-style advertisement urging locals to purchase war bonds. Bold red lettering stands out against the weathered brick, a reminder that every dollar spent here brings the front lines one step closer to victory.',
    },
    vehicle: {
      title: 'Military-Style Transport',
      description:
        'A utilitarian sedan painted in olive-drab, its grille reinforced with heavy vertical bars. Painted-over headlights and canvas-covered rear seats speak to wartime restrictions — civilian luxury takes a back seat to duty.',
    },
    pedestrian: {
      title: 'Civilian Worker',
      description:
        'Dressed in a heavy wool coat and flat cap, this person walks briskly along the sidewalk carrying a satchel. Ration coupons peek from a pocket. The war has changed daily routines — everyone moves with purpose now.',
    },
  },

  // ════════════════════════════════════════════════════
  // 1965 — Mid-Century Modern
  // ════════════════════════════════════════════════════
  '1965': {
    building: {
      title: 'Mid-Century Commerce Block',
      description:
        'Clean limestone lines and large plate-glass windows define this post-war commercial building. A decorative concrete cornice crowns the roofline, and a small rooftop antenna picks up color television signals for nearby apartments.',
    },
    storefront: {
      title: 'Diner Window Display',
      description:
        'Bright chrome-framed posters advertise milkshakes and fresh-baked burgers. The window display features plastic food replicas arranged with cheerful mid-century flair. A swinging door announces customers with a cheerful jingle.',
    },
    billboard: {
      title: 'Neon Drive-In Sign',
      description:
        'A towering neon-lit billboard advertising a drive-in theatre. The curving retro font glows electric blue against a starfield background. On quiet evenings, the distant hum of car engines and movie dialogue drifts across the neighborhood.',
    },
    'wall-ad': {
      title: 'Soda Pop Fresco',
      description:
        'A vibrant wall painting promoting a local soda brand with swirling bubble graphics and bold primary colors. The artist signed the piece in the corner — street art was becoming a legitimate form of urban expression.',
    },
    vehicle: {
      title: 'Tailfin Sedan',
      description:
        'A gleaming chrome-laden sedan with dramatic tailfins reaching skyward. Dual exhaust pipes rumble lazily, and whitewall tires gleam under the afternoon sun. This car is less transportation and more rolling sculpture.',
    },
    pedestrian: {
      title: 'Modenly Dressed Stroller',
      description:
        'Wearing a tailored suit and fedora, this gentleman strolls past with a newspaper tucked under his arm. His polished shoes reflect the pavement, and a pocket square adds a touch of color — style matters in the age of prosperity.',
    },
  },

  // ════════════════════════════════════════════════════
  // 1985 — Neon & New Wave
  // ════════════════════════════════════════════════════
  '1985': {
    building: {
      title: 'Synthwave Office Tower',
      description:
        'Glass-and-steel construction with a reflective curtain-wall facade that mirrors the neon signs below. Rooftop equipment includes a cluster of satellite dishes and a massive HVAC unit humming softly — progress never sleeps.',
    },
    storefront: {
      title: 'Arcade Frontage',
      description:
        'The entire ground floor pulses with arcade game glow. Pixel-art characters dance across the storefront windows, and the bass-heavy soundtrack spills onto the sidewalk. A queue of teenagers waits patiently for a turn.',
    },
    billboard: {
      title: 'Cassette Culture Poster',
      description:
        'A massive rooftop billboard featuring geometric shapes and gradient fills — pure 80s graphic design. The headline reads "Tape It Forward," encouraging music lovers to share mixtapes. Animated LED letters scroll beneath.',
    },
    'wall-ad': {
      title: 'Synth Album Mural',
      description:
        'A full-height wall mural promoting a fictional synth-pop album. Electric purple and hot pink gradients bleed into each other, bordered by a grid of tiny glowing dots. Graffiti artists have added their own signature tags.',
    },
    vehicle: {
      title: 'Boxy European Sedan',
      description:
        'Angular lines and quad sealed-beam headlights give this sedan a distinctly 1980s silhouette. The interior is upholstered in gray velour, and the dashboard is covered in analog gauges. It smells faintly of new-car plastic.',
    },
    pedestrian: {
      title: 'New Wave Commuter',
      description:
        'Asymmetrical haircut, oversized sunglasses, and a leather jacket over a graphic tee. A boombox rests on one shoulder, pumping out synthesized beats. A walkie-talkie clipped to the belt blinks with Morse-code urgency.',
    },
  },

  // ════════════════════════════════════════════════════
  // 2005 — Y2K / Dot-com Bust
  // ════════════════════════════════════════════════════
  '2005': {
    building: {
      title: 'Strip-Mall Commercial Center',
      description:
        'A one-story retail complex with stucco finish and a corrugated metal parapet. Storefront awnings in alternating colors shade the parking lot entrance. A satellite dish clings awkwardly to the side wall near the loading dock.',
    },
    storefront: {
      title: 'Big-Box Retail Front',
      description:
        'Oversized glass doors with yellow price stickers and a roll-down security gate pulled halfway. The window displays feature mannequins dressed in fast-fashion trends — loud prints and low-rise everything.',
    },
    billboard: {
      title: 'Mobile Carrier Billboard',
      description:
        'A towering roadside billboard advertising unlimited texting plans. A cartoon smartphone beams a heart emoji across the sky. The slogan promises connection — even as the dot-com bust lingers in the background.',
    },
    'wall-ad': {
      title: 'Fast-Food Wall Decal',
      description:
        'A large vinyl decal wrapped around the building corner promotes a burger chain\'s latest value meal. Bright red and yellow dominate the palette. Grease stains near the bottom suggest years of urban wear.',
    },
    vehicle: {
      title: 'Taxi Cab',
      description:
        'A bright yellow sedan with a lit rooftop sign and a dent on the rear bumper from years of city driving. The meter ticks steadily inside, and the driver leans against the hood scrolling through a flip phone between fares.',
    },
    pedestrian: {
      title: 'Tech-Bro Casual',
      description:
        'Black turtleneck, cargo pants, and a laptop bag slung over one shoulder. Talking on a cell phone with one earbud dangling, this pedestrian navigates the sidewalk with the confidence of someone who thinks they\'re going to change the world.',
    },
  },

  // ════════════════════════════════════════════════════
  // 2025 — Modern Smart City
  // ════════════════════════════════════════════════════
  '2025': {
    building: {
      title: 'Smart Glass Tower',
      description:
        'Floor-to-ceiling electrochromic glass shifts opacity throughout the day to regulate interior temperature. Solar panels tile the green roof alongside native wildflower plantings. An autonomous delivery bot whirs quietly at the ground-floor entrance.',
    },
    storefront: {
      title: 'Experience Retail Space',
      description:
        'A seamless glass storefront with no visible door frame — it slides open automatically as shoppers approach. Inside, holographic displays float above minimalist pedestals. The store sells nothing you can buy online, only experiences.',
    },
    billboard: {
      title: 'Digital Sky-Screen',
      description:
        'An enormous transparent OLED panel mounted between two towers streams real-time ambient art and air-quality data. Passersby\'s reflections merge with the digital content, creating an ever-changing layered composition.',
    },
    'wall-ad': {
      title: 'Eco-Art Installation',
      description:
        'Part advertisement, part environmental art: a living moss wall embedded with solar-powered LED text cycling through sustainability tips. Bees visit the planted sections while commuters glance up from their augmented-reality glasses.',
    },
    vehicle: {
      title: 'Autonomous EV Pod',
      description:
        'A smooth, teardrop-shaped electric vehicle with no steering wheel or pedals. LiDAR domes rotate silently atop the roof while sensor arrays scan the road ahead. The cabin glows softly from within, occupied by passengers reading e-books.',
    },
    pedestrian: {
      title: 'Smart-City Resident',
      description:
        'Wearing a lightweight exoskeleton brace on one leg and AR contact lenses, this person glides effortlessly along the heated sidewalk. A micro-scooter docks nearby, and their wristband pings with a transit notification.',
    },
  },
};

/**
 * Look up inspection copy for a given era and object type.
 * @param eraId   — active era identifier
 * @param type    — category of inspected object
 * @returns       — descriptive copy entry, or undefined if missing
 */
export function getInspectionCopy(
  eraId: EraId,
  type: InspectObjectType,
): CopyEntry | undefined {
  return INSPECTION_COPY[eraId]?.[type];
}
