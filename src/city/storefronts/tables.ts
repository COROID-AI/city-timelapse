/**
 * Per-era storefront, signage and advertising tables.
 *
 * This is the only place in the layer where period copy lives: shop types and
 * their trading names, fascia and price wording, sign materials, letterforms,
 * advertising campaigns, sandwich-board messages and the graffiti programme.
 * Editing a period is a data edit here, never a branch inside the generator, so
 * a sixth era would be one more record.
 *
 * Everything is derived from the era model (`src/era`) — the loader in
 * {@link storefrontEraData} validates the id against the real registry, and
 * {@link signageEmissiveIntensity} turns the registry's lighting values into the
 * emissive strength the renderer puts on sign materials.
 */

import {
  ERA_IDS,
  getEra,
  isKnownEraId,
  type EraDefinition,
  type EraId,
  type EraLighting,
} from '../../era'
import {
  ADVERTISING_KINDS,
  ILLUMINATION_GAIN,
  type AdCopy,
  type AdvertisingKind,
  type AdvertisingMix,
  type GraffitiProfile,
  type IlluminationKind,
  type LetterformStyle,
  type ShopType,
  type StorefrontEraData,
} from './types'

/** Eras this layer dresses, in timeline order: the registry's own order. */
export const STOREFRONT_ERA_IDS: readonly EraId[] = [...ERA_IDS]

/** Fraction of the emissive strength a sign keeps in daylight. */
export const DAYLIGHT_EMISSIVE_FRACTION = 0.5

function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/* ------------------------------------------------------------------------- *
 * Letterforms
 * ------------------------------------------------------------------------- */

/** One period's type personality, as parameters of the bundled stroke font. */
export const LETTERFORMS: Readonly<Record<EraId, LetterformStyle>> = {
  '1945': {
    id: '1945-hand-lettered',
    label: 'Hand-lettered block serif',
    family: 'painted-serif',
    weight: 0.14,
    slant: 0,
    tracking: 0.08,
    xScale: 1,
    serifs: true,
    outline: false,
    shadow: true,
    ligatures: false,
    caps: true,
  },
  '1965': {
    id: '1965-googie-neon',
    label: 'Googie neon script',
    family: 'script',
    weight: 0.12,
    slant: 0.16,
    tracking: 0.12,
    xScale: 1.12,
    serifs: false,
    outline: false,
    shadow: false,
    ligatures: true,
    caps: true,
  },
  '1985': {
    id: '1985-extended-chrome',
    label: 'Chrome extended sans',
    family: 'extended-sans',
    weight: 0.2,
    slant: 0,
    tracking: 0.1,
    xScale: 1.26,
    serifs: false,
    outline: true,
    shadow: false,
    ligatures: false,
    caps: true,
  },
  '2005': {
    id: '2005-grotesque',
    label: 'Neutral grotesque',
    family: 'grotesque',
    weight: 0.16,
    slant: 0,
    tracking: 0.04,
    xScale: 1,
    serifs: false,
    outline: false,
    shadow: false,
    ligatures: false,
    caps: true,
  },
  '2025': {
    id: '2025-geometric',
    label: 'Geometric sans',
    family: 'geometric',
    weight: 0.1,
    slant: 0,
    tracking: 0.06,
    xScale: 0.98,
    serifs: false,
    outline: false,
    shadow: false,
    ligatures: false,
    caps: true,
  },
}

/* ------------------------------------------------------------------------- *
 * 1945 — the home front
 * ------------------------------------------------------------------------- */

const SHOPS_1945: readonly ShopType[] = [
  {
    id: 'wartime-grocer',
    label: 'Wartime grocer',
    category: 'food',
    names: ['HOME FRONT GROCERY', 'VICTORY MARKET', 'STAR GROCERY', 'M. KOWALSKI GROCER'],
    signLines: ['GROCERIES & PROVISIONS', 'RATION BOOKS HONOURED', 'BUTTER · EGGS · LARD'],
    priceLines: ['SUGAR 5 LB 23¢', 'COFFEE 1 LB 30¢'],
    awning: 'canvas-stripe',
    joinery: 'timber',
    shutter: 'open',
  },
  {
    id: 'bakery',
    label: 'Neighbourhood bakery',
    category: 'food',
    names: ['BLOCK BAKERY', 'HOMESTEAD BAKERY', 'SUNRISE BAKERY'],
    signLines: ['BREAD BAKED DAILY', 'CAKES & PASTRY', 'WEDDING CAKES TO ORDER'],
    priceLines: ['RYE LOAF 9¢', 'DOZEN BUNS 15¢'],
    awning: 'canvas-stripe',
    joinery: 'timber',
    shutter: 'open',
  },
  {
    id: 'tailor',
    label: 'Tailor and presser',
    category: 'services',
    names: ['FERRARO & SONS TAILORS', 'THE GENTS TAILOR', 'MODE TAILORING'],
    signLines: ['SUITS TO MEASURE', 'REPAIRS & PRESSING', 'UNIFORMS ALTERED'],
    priceLines: ['PRESSING 15¢', 'SUIT CLEANED 60¢'],
    awning: 'solid-canvas',
    joinery: 'timber',
    shutter: 'open',
  },
  {
    id: 'hardware',
    label: 'Hardware store',
    category: 'retail',
    names: ['BLOCK HARDWARE', 'CITY HARDWARE CO', 'OLSEN HARDWARE'],
    signLines: ['HARDWARE & PAINT', 'GARDEN TOOLS · SEEDS', 'KEYS CUT WHILE YOU WAIT'],
    priceLines: ['PAINT $1.20 GAL', 'NAILS 8¢ LB'],
    awning: 'canvas-stripe',
    joinery: 'timber',
    shutter: 'open',
  },
  {
    id: 'butcher',
    label: 'Butcher',
    category: 'food',
    names: ['H. BRADY BUTCHER', 'QUALITY MEATS', 'PARK VIEW BUTCHER'],
    signLines: ['FRESH MEATS', 'POULTRY & GAME', 'CHOPS CUT TO ORDER'],
    priceLines: ['BEEF 32¢ LB', 'SAUSAGE 25¢ LB'],
    awning: 'canvas-stripe',
    joinery: 'timber',
    shutter: 'open',
  },
  {
    id: 'pharmacy-soda-fountain',
    label: 'Pharmacy and soda fountain',
    category: 'retail',
    names: ['GRAND PHARMACY', 'RELIABLE DRUG CO', 'CORNER DRUG STORE'],
    signLines: ['PRESCRIPTIONS · SODA', 'SUNDRIES & TOBACCO', 'FIRST AID SUPPLIES'],
    priceLines: ['ASPIRIN 19¢', 'FOUNTAIN COLA 5¢'],
    awning: 'rigid-canopy',
    joinery: 'painted-steel',
    shutter: 'folding-gate',
  },
]

const ADS_1945: Readonly<Record<AdvertisingKind, readonly AdCopy[]>> = {
  billboard: [
    {
      brand: 'BUY WAR BONDS',
      headline: 'BUY WAR BONDS',
      body: 'BACK THE ATTACK · LOAN DRIVE CLOSES SATURDAY',
      price: '10% DOWN',
      tag: 'war-bonds',
    },
    {
      brand: 'LUCKY STRIKE',
      headline: 'LUCKY STRIKE',
      body: 'SO ROUND · SO FIRM · SO FULLY PACKED',
      price: '15¢ PACK',
      tag: 'lucky-strike',
    },
    {
      brand: 'COCA-COLA',
      headline: 'COCA-COLA',
      body: 'THE ONLY THING LIKE A COKE IS ANOTHER COKE',
      price: '5¢',
      tag: 'coca-cola',
    },
    {
      brand: 'FORD V-8',
      headline: 'FORD V-8',
      body: 'VICTORY IS OUR BUSINESS · FORD BUILT FOR THE DURATION',
      price: 'FROM $690',
      tag: 'ford-v8',
    },
  ],
  'painted-wall': [
    {
      brand: 'WRIGLEY SPEARMINT',
      headline: 'WRIGLEY SPEARMINT',
      body: 'THE FLAVOUR LASTS · STILL ONLY A NICKEL',
      price: '5¢',
      tag: 'wrigley-spearmint',
    },
    {
      brand: 'COCA-COLA',
      headline: 'COKE REFRESHES YOU',
      body: 'PAUSE AND REFRESH · ICE-COLD AT YOUR DRUG STORE',
      price: '5¢',
      tag: 'coca-cola',
    },
    {
      brand: 'WAR BONDS',
      headline: 'KEEP EM FLYING',
      body: 'EVERY BOND IS A BLOW FOR FREEDOM · BUY AT THIS BANK',
      price: '$18.75 SERIES E',
      tag: 'war-bonds',
    },
  ],
  'poster-panel': [
    {
      brand: 'O.P.A. RATIONING',
      headline: 'RATIONS THIS WEEK',
      body: 'MEAT 1 LB · SUGAR 5 LB · GASOLINE A-3 COUPON',
      price: 'BOOK 3',
      tag: 'war-bonds',
    },
    {
      brand: 'LUCKY STRIKE',
      headline: 'IT IS TOASTED',
      body: 'LUCKY STRIKE MEANS FINE TOBACCO · 20 IN EVERY PACK',
      price: '15¢',
      tag: 'lucky-strike',
    },
    {
      brand: 'FORD MOTOR CO',
      headline: 'YOUR NEXT CAR',
      body: 'WHEN THE BOYS COME HOME · SEE YOUR FORD DEALER',
      price: 'V-8 ENGINE',
      tag: 'ford-v8',
    },
    {
      brand: 'PLEDGE TO BUY',
      headline: 'BONDS BUY TANKS',
      body: 'SIGN THE PLEDGE CARD AT THE COUNTER INSIDE',
      price: '10% PAYROLL',
      tag: 'war-bonds',
    },
  ],
  'newspaper-board': [
    {
      brand: 'DAILY HERALD',
      headline: 'V-E DAY EXTRA',
      body: 'WAR ENDS IN EUROPE · WAR BOND SUPPLEMENT INSIDE',
      price: '3¢',
      tag: 'war-bonds',
    },
    {
      brand: 'EVENING STAR',
      headline: 'HOME FRONT NEWS',
      body: 'FACTORY OUTPUT UP · COLA ON EVERY BASTION',
      price: '3¢',
      tag: 'coca-cola',
    },
  ],
  transient: [
    {
      brand: 'WAR BONDS',
      headline: 'BONDS SOLD HERE',
      body: 'BRING YOUR RATION BOOK · OPEN TILL 8 PM',
      price: '$18.75',
      tag: 'war-bonds',
    },
    {
      brand: 'WRIGLEY',
      headline: 'CHEWING GUM',
      body: 'FOR THE BOYS OVERSEAS · PACKS AND CARTONS',
      price: '5¢',
      tag: 'wrigley-spearmint',
    },
  ],
}

const ADV_MIX_1945: AdvertisingMix = {
  billboard: 2,
  'painted-wall': 4,
  'poster-panel': 3,
  'newspaper-board': 2,
  transient: 1,
}

const GRAFFITI_1945: GraffitiProfile = {
  state: 'none',
  density: 0,
  styles: ['remnant'],
  messages: ['BLACKOUT TONIGHT', 'KEEP IT QUIET'],
  colours: ['#3a3126'],
}

/* ------------------------------------------------------------------------- *
 * 1965 — appliances, colour television, the road
 * ------------------------------------------------------------------------- */

const SHOPS_1965: readonly ShopType[] = [
  {
    id: 'appliance-dealer',
    label: 'Appliance dealer',
    category: 'retail',
    names: ['GENERAL APPLIANCE', 'MODERN HOME APPLIANCES', 'A-1 ELECTRIC'],
    signLines: ['REFRIGERATORS · RANGES', 'COLOR TV · STEREO', 'EASY TERMS · 30 DAYS'],
    priceLines: ['CAPRI FRIDGE $199.95', 'HI-FI FROM $89'],
    awning: 'metal-canopy',
    joinery: 'aluminium',
    shutter: 'open',
  },
  {
    id: 'diner',
    label: 'Diner',
    category: 'food',
    names: ['STARLITE DINER', 'THE EAGLE DINER', 'BLUE COMET DINER'],
    signLines: ['SHORT ORDERS · FOUNTAIN', 'OPEN ALL NIGHT', 'BURGERS · SHAKES · FRIES'],
    priceLines: ['BURGER 35¢', 'MALTED 45¢'],
    awning: 'solid-canvas',
    joinery: 'aluminium',
    shutter: 'open',
  },
  {
    id: 'record-shop',
    label: 'Record shop',
    category: 'entertainment',
    names: ['SPIN-A-DISC', 'DISCOUNT RECORDS', 'SOUND CENTRE'],
    signLines: ['45s · LPs · HI-FI', 'LISTENING BOOTHS', 'NEW RELEASES TUESDAY'],
    priceLines: ['LP $2.98', '45 SINGLE 79¢'],
    awning: 'canvas-stripe',
    joinery: 'painted-steel',
    shutter: 'open',
  },
  {
    id: 'department-store',
    label: 'Department store',
    category: 'retail',
    names: ['GRAND-VIEW DEPARTMENT STORE', 'BLOCK & CO', 'CITY DRY GOODS'],
    signLines: ['EVERYTHING FOR THE FAMILY', 'CREDIT TERMS AVAILABLE', 'AIR CONDITIONED THROUGHOUT'],
    priceLines: ['DRESS SHIRTS 2 FOR $5', 'TOWELS 89¢'],
    awning: 'rigid-canopy',
    joinery: 'aluminium',
    shutter: 'open',
  },
  {
    id: 'gas-station',
    label: 'Service station',
    category: 'services',
    names: ['SINCLAIR SERVICE', 'TEXACO SERVICE', 'MURPHY SERVICE'],
    signLines: ['GAS · OIL · TIRES', 'ROAD MAPS · FREE AIR', 'SERVICE WITH A SMILE'],
    priceLines: ['REGULAR 30.9¢ GAL', 'PREMIUM 32.9¢ GAL'],
    awning: 'rigid-canopy',
    joinery: 'painted-steel',
    shutter: 'open',
  },
  {
    id: 'bowling-alley',
    label: 'Bowling alley',
    category: 'entertainment',
    names: ['BLOCK LANES', 'SUNSET BOWL', 'LUCKY STRIKE LANES'],
    signLines: ['BOWLING · BILLIARDS', 'OPEN TILL MIDNIGHT', 'LEAGUE NIGHT WEDNESDAYS'],
    priceLines: ['GAME 50¢', 'SODA 15¢'],
    awning: 'solid-canvas',
    joinery: 'painted-steel',
    shutter: 'open',
  },
]

const ADS_1965: Readonly<Record<AdvertisingKind, readonly AdCopy[]>> = {
  billboard: [
    {
      brand: 'COCA-COLA',
      headline: 'THINGS GO BETTER WITH COKE',
      body: 'ICE-COLD IN THE NEW CONTOUR BOTTLE',
      price: '10¢',
      tag: 'coca-cola',
    },
    {
      brand: 'SINCLAIR',
      headline: 'SINCLAIR DINOLAND',
      body: 'DRIVE WITH CARE · WE DO · PENNSYLVANIA CRUDE',
      price: '30.9¢ GAL',
      tag: 'sinclair-dino',
    },
    {
      brand: 'RCA VICTOR',
      headline: 'RCA COLOR TV',
      body: 'THE MOST TRUSTED NAME IN TELEVISION',
      price: 'FROM $379',
      tag: 'rca-color-tv',
    },
    {
      brand: 'FORD MUSTANG',
      headline: 'FORD MUSTANG',
      body: 'TOTAL PERFORMANCE · 289 V-8 · BUCKET SEATS',
      price: 'FROM $2,368',
      tag: 'ford-mustang',
    },
  ],
  'painted-wall': [
    {
      brand: 'PEPSI-COLA',
      headline: 'COME ALIVE',
      body: 'YOU ARE IN THE PEPSI GENERATION · 12 OZ BOTTLE',
      price: '10¢',
      tag: 'pepsi-generation',
    },
    {
      brand: 'RCA VICTOR',
      headline: 'COLOR BY RCA',
      body: 'WATCH THE WORLD SERIES THE WAY IT WAS PLAYED',
      price: '$379',
      tag: 'rca-color-tv',
    },
    {
      brand: 'FORD',
      headline: 'SEE THE USA',
      body: 'IN YOUR FORD · NEW FORD WAGON FOR 1965',
      price: '$2,105',
      tag: 'ford-mustang',
    },
  ],
  'poster-panel': [
    {
      brand: 'SINCLAIR',
      headline: 'FREE ROAD MAPS',
      body: 'FULL SERVICE AT THE DINOSAUR · TIRES AND BATTERIES',
      price: '30.9¢',
      tag: 'sinclair-dino',
    },
    {
      brand: 'PEPSI-COLA',
      headline: 'TAKE HOME A CASE',
      body: 'SIX 12 OZ BOTTLES · DEPOSIT REFUNDED',
      price: '59¢',
      tag: 'pepsi-generation',
    },
    {
      brand: 'RCA VICTOR',
      headline: 'COLOR TV DEMO',
      body: 'SEE IT TODAY · EASY TERMS · 30 DAY TRIAL',
      price: '$10 DOWN',
      tag: 'rca-color-tv',
    },
    {
      brand: 'COCA-COLA',
      headline: 'THE PAUSE THAT REFRESHES',
      body: 'COLD BOTTLES ON ICE AT EVERY COUNTER',
      price: '10¢',
      tag: 'coca-cola',
    },
  ],
  'newspaper-board': [
    {
      brand: 'THE JOURNAL',
      headline: 'MAN ON THE MOON',
      body: 'SPACE RACE SPECIAL · MUSTANG ROAD TEST INSIDE',
      price: '7¢',
      tag: 'ford-mustang',
    },
    {
      brand: 'EVENING POST',
      headline: 'WORLD SERIES',
      body: 'GAME FIVE IN COLOR · LIVE ON RCA VICTOR',
      price: '7¢',
      tag: 'rca-color-tv',
    },
  ],
  transient: [
    {
      brand: 'DINER',
      headline: '2 BURGERS 60¢',
      body: 'TODAY ONLY · WITH FRIES AND A SHAKE',
      price: '60¢',
      tag: 'coca-cola',
    },
    {
      brand: 'BOWLING',
      headline: 'LEAGUE SIGN-UP',
      body: 'WEDNESDAY NIGHTS · TEAMS OF FOUR · TROPHIES',
      price: '50¢ GAME',
      tag: 'pepsi-generation',
    },
    {
      brand: 'SERVICE',
      headline: 'OIL CHANGE $3.95',
      body: 'PLUS FREE TIRE CHECK AND ROAD MAP',
      price: '$3.95',
      tag: 'sinclair-dino',
    },
  ],
}

const ADV_MIX_1965: AdvertisingMix = {
  billboard: 4,
  'painted-wall': 2,
  'poster-panel': 4,
  'newspaper-board': 2,
  transient: 2,
}

const GRAFFITI_1965: GraffitiProfile = {
  state: 'tags',
  density: 0.22,
  styles: ['tag', 'stencil', 'paste-up'],
  messages: ['THE BEAT GOES ON', 'CLASS OF 65', 'JAZZ TONIGHT', 'VOTE'],
  colours: ['#dcd6c8', '#c9b28a', '#8fa3b8'],
}

/* ------------------------------------------------------------------------- *
 * 1985 — neon, chrome, video
 * ------------------------------------------------------------------------- */

const SHOPS_1985: readonly ShopType[] = [
  {
    id: 'video-rental',
    label: 'Video rental',
    category: 'entertainment',
    names: ['VIDEO VAULT', 'TAPES & TAKES', 'MIDNIGHT VIDEO'],
    signLines: ['VHS · BETA RENTALS', 'NEW RELEASES · BE KIND REWIND', '2 FOR 1 TUESDAYS'],
    priceLines: ['RENTAL $2.50', 'TWO NIGHTS $4'],
    awning: 'solid-canvas',
    joinery: 'aluminium',
    shutter: 'roller-grille',
  },
  {
    id: 'arcade',
    label: 'Video arcade',
    category: 'entertainment',
    names: ['STARBASE ARCADE', 'TILT ARCADE', 'NEON QUARTER'],
    signLines: ['25¢ PER PLAY · TOKENS', 'GALAXA · LASER RAID', 'HIGH SCORES PAID IN CASH'],
    priceLines: ['TOKENS 5 FOR $1', 'PINBALL 2 FOR 25¢'],
    awning: 'solid-canvas',
    joinery: 'painted-steel',
    shutter: 'roller-grille',
  },
  {
    id: 'electronics',
    label: 'Electronics shop',
    category: 'technology',
    names: ['CIRCUIT CITY', 'AUDIO VIDEO WORLD', 'BYTE SHOP'],
    signLines: ['STEREOS · VCRS · COMPUTERS', 'COMMODORE 64 IN STOCK', 'WE SERVICE WHAT WE SELL'],
    priceLines: ['VCR $299', 'WALKMAN $79.99'],
    awning: 'metal-canopy',
    joinery: 'aluminium',
    shutter: 'roller-grille',
  },
  {
    id: 'pizza-parlour',
    label: 'Pizza parlour',
    category: 'food',
    names: ['NINO PIZZA', 'SLICE OF THE CITY', 'PIZZA EXPRESS'],
    signLines: ['PIZZA · SUBS · SALAD BAR', 'FREE DELIVERY · 555-0199', 'HOT SLICE TILL 2 AM'],
    priceLines: ['LARGE $8.95', 'SLICE 89¢'],
    awning: 'canvas-stripe',
    joinery: 'painted-steel',
    shutter: 'open',
  },
  {
    id: 'convenience-store',
    label: 'Convenience store',
    category: 'retail',
    names: ['24 HOUR MART', 'QUICK STOP', 'NIGHT OWL MARKET'],
    signLines: ['OPEN 24 HOURS', 'BEER · CIGARETTES · LOTTO', 'ATM INSIDE'],
    priceLines: ['SODA 6-PACK $2.99', 'CIGARETTES $1.35'],
    awning: 'solid-canvas',
    joinery: 'painted-steel',
    shutter: 'open',
  },
  {
    id: 'record-and-tape',
    label: 'Record and tape shop',
    category: 'entertainment',
    names: ['TAPES & VINYL', 'THE RECORD EXCHANGE', 'MIXTAPE RECORDS'],
    signLines: ['VINYL · CASSETTES · CDS', 'IMPORTS & 12 INCH SINGLES', 'TRADE-INS WELCOME'],
    priceLines: ['CASSETTE $6.99', '12 INCH SINGLE $4.49'],
    awning: 'canvas-stripe',
    joinery: 'painted-steel',
    shutter: 'roller-grille',
  },
]

const ADS_1985: Readonly<Record<AdvertisingKind, readonly AdCopy[]>> = {
  billboard: [
    {
      brand: 'PEPSI',
      headline: 'THE CHOICE OF A NEW GENERATION',
      body: 'PEPSI-COLA · NEW LOOK · SAME TASTE',
      price: '55¢ 12 OZ',
      tag: 'pepsi-michael-jackson',
    },
    {
      brand: 'APPLE',
      headline: 'INTRODUCING MACINTOSH',
      body: 'THE COMPUTER FOR THE REST OF US · MOUSE INCLUDED',
      price: '$2,495',
      tag: 'apple-macintosh',
    },
    {
      brand: 'NIKE',
      headline: 'JUST DO IT',
      body: 'AIR CUSHIONING · BUILT FOR THE STREET',
      price: 'AIR FROM $75',
      tag: 'nike-swoosh',
    },
    {
      brand: 'MTV',
      headline: 'MUSIC TELEVISION',
      body: '24 HOURS A DAY · YOU WANT YOUR MTV',
      price: 'CABLE CH 24',
      tag: 'mtv-logo',
    },
    {
      brand: 'COCA-COLA',
      headline: 'COCA-COLA CLASSIC',
      body: 'THE ORIGINAL FORMULA IS BACK · STOCK UP',
      price: '2 LITRE $1.29',
      tag: 'coca-cola-classic',
    },
  ],
  'painted-wall': [
    {
      brand: 'NIKE',
      headline: 'RUN THE CITY',
      body: 'SWOOSH ON EVERY STREET CORNER · TRACK CLUB SIGN-UP',
      price: '$75 AIR',
      tag: 'nike-swoosh',
    },
    {
      brand: 'MTV',
      headline: 'VIDEO KILLED THE RADIO STAR',
      body: 'WATCH THE CHARTS COUNT DOWN · SATURDAY 8 PM',
      price: 'CH 24',
      tag: 'mtv-logo',
    },
  ],
  'poster-panel': [
    {
      brand: 'APPLE',
      headline: '64K RAM $999',
      body: 'MACINTOSH 512K · LASERWRITER · APPLE TALK',
      price: '$2,495',
      tag: 'apple-macintosh',
    },
    {
      brand: 'AEROBICS',
      headline: 'WORKOUT ON VHS',
      body: '30 MINUTE PROGRAMME · RENTAL $2.50',
      price: '$29.95 BUY',
      tag: 'pepsi-michael-jackson',
    },
    {
      brand: 'PHONE',
      headline: 'LONG DISTANCE 25¢',
      body: 'AFTER 11 PM · ANYWHERE IN THE STATE',
      price: '25¢',
      tag: 'coca-cola-classic',
    },
    {
      brand: 'NIKE',
      headline: 'NEW AIR COLOURS',
      body: 'HIGH TOPS AND RUNNERS · SIZES 6 TO 13',
      price: '$75',
      tag: 'nike-swoosh',
    },
    {
      brand: 'MTV',
      headline: 'CALL FOR VIDEOS',
      body: 'REQUEST LINE OPEN TILL MIDNIGHT',
      price: '555-0108',
      tag: 'mtv-logo',
    },
  ],
  'newspaper-board': [
    {
      brand: 'USA TODAY',
      headline: 'MARKET SURGE',
      body: 'TECH STOCKS SOAR · MACINTOSH REVIEW INSIDE',
      price: '50¢',
      tag: 'apple-macintosh',
    },
  ],
  transient: [
    {
      brand: 'VIDEO VAULT',
      headline: 'HALF PRICE TAPES',
      body: 'TODAY ONLY · TWO FOR THE PRICE OF ONE',
      price: '$2.50',
      tag: 'coca-cola-classic',
    },
    {
      brand: 'ARCADE',
      headline: 'BINGO NIGHT 7 PM',
      body: 'CASH PRIZE JACKPOT · TOKENS AT THE DOOR',
      price: '$1 CARD',
      tag: 'pepsi-michael-jackson',
    },
    {
      brand: 'HIRING',
      headline: 'HELP WANTED',
      body: 'COUNTER STAFF · EVENINGS AND WEEKENDS',
      price: '$4.25 HR',
      tag: 'nike-swoosh',
    },
  ],
}

const ADV_MIX_1985: AdvertisingMix = {
  billboard: 5,
  'painted-wall': 2,
  'poster-panel': 5,
  'newspaper-board': 1,
  transient: 3,
}

const GRAFFITI_1985: GraffitiProfile = {
  state: 'murals',
  density: 0.8,
  styles: ['mural', 'throw-up', 'tag'],
  messages: ['FRESH', 'WILD STYLE', 'B-BOY', 'ELECTRIC', '1985'],
  colours: ['#ff2f8f', '#00e5ff', '#ffe14d', '#7dff5a', '#f5f2ea'],
}

/* ------------------------------------------------------------------------- *
 * 2005 — dot-com, mobile phones, coffee chains
 * ------------------------------------------------------------------------- */

const SHOPS_2005: readonly ShopType[] = [
  {
    id: 'chain-pharmacy',
    label: 'Chain pharmacy',
    category: 'retail',
    names: ['CITY DRUGS', 'WELLCARE PHARMACY', 'CORNER PHARMACY'],
    signLines: ['PRESCRIPTIONS · PHOTO · COSMETICS', 'DRIVE-THRU PICKUP', 'OPEN 24 HOURS'],
    priceLines: ['$4 GENERICS', 'VITAMINS 2 FOR $12'],
    awning: 'rigid-canopy',
    joinery: 'aluminium',
    shutter: 'open',
  },
  {
    id: 'coffee-chain',
    label: 'Coffee chain',
    category: 'food',
    names: ['BEAN & LEAF COFFEE', 'GROUNDWORK COFFEE', 'CAFFE BLOCK'],
    signLines: ['ESPRESSO · LATTE · WIFI', 'SKIM · SOY · NO WHIP', 'HANDCRAFTED DRINKS'],
    priceLines: ['LATTE $3.45', 'MUFFIN $2.25'],
    awning: 'fabric-logo',
    joinery: 'aluminium',
    shutter: 'open',
  },
  {
    id: 'mobile-store',
    label: 'Mobile phone store',
    category: 'technology',
    names: ['TALK & TEXT WIRELESS', 'CELLPOINT', 'MOBILE HUB'],
    signLines: ['CELL PHONES · PLANS', 'UPGRADE TODAY · FREE FLIP PHONE', 'TEXT UNLIMITED $9.99'],
    priceLines: ['ACTIVATION $0', '2-YEAR PLAN $39.99'],
    awning: 'solid-canvas',
    joinery: 'aluminium',
    shutter: 'roller-grille',
  },
  {
    id: 'internet-cafe',
    label: 'Internet cafe',
    category: 'technology',
    names: ['TERMINAL CAFE', 'BINARY BITS INTERNET CAFE', 'WEBKEY'],
    signLines: ['HIGH SPEED INTERNET', '$3 PER HOUR · BURN A CD', 'SCAN · FAX · PHOTO'],
    priceLines: ['1 HOUR $3.00', 'DAY PASS $12'],
    awning: 'solid-canvas',
    joinery: 'aluminium',
    shutter: 'open',
  },
  {
    id: 'copy-shop',
    label: 'Copy shop',
    category: 'services',
    names: ['COPYWORKS', 'PRINT & MAIL CENTRE', 'FASTCOPY'],
    signLines: ['COPIES · FAX · BINDING', 'BANNERS WHILE YOU WAIT', 'OPEN 7 DAYS'],
    priceLines: ['COPY 8¢', '500 PAGES $19.99'],
    awning: 'metal-canopy',
    joinery: 'aluminium',
    shutter: 'open',
  },
  {
    id: 'fast-casual-salad',
    label: 'Fast-casual salad bar',
    category: 'food',
    names: ['GREENS & GRAINS', 'SALAD BAR 2000', 'FRESH TOSS'],
    signLines: ['BUILD YOUR OWN SALAD', 'WRAPS · SOUPS · SMOOTHIES', 'CATERING AVAILABLE'],
    priceLines: ['SALAD $6.95', 'SMOOTHIE $3.95'],
    awning: 'fabric-logo',
    joinery: 'painted-steel',
    shutter: 'open',
  },
]

const ADS_2005: Readonly<Record<AdvertisingKind, readonly AdCopy[]>> = {
  billboard: [
    {
      brand: 'iPod',
      headline: '1,000 SONGS IN YOUR POCKET',
      body: 'MAC OR PC · 20 GB · 12 HOUR BATTERY',
      price: '$299',
      tag: 'ipod-silhouette',
    },
    {
      brand: 'MOTOROLA',
      headline: 'RAZR · FREE WITH PLAN',
      body: 'THINNER THAN A CD CASE · BLUETOOTH HEADSET READY',
      price: 'FREE',
      tag: 'motorola-razr',
    },
    {
      brand: 'STARBUCKS COFFEE',
      headline: 'HANDCRAFTED BEVERAGES',
      body: 'FAIR TRADE BEANS · YOUR NAME ON THE CUP',
      price: '$3.45 LATTE',
      tag: 'starbucks-mermaid',
    },
    {
      brand: 'NIKE',
      headline: 'JUST DO IT',
      body: 'RUN THE BLOCK · AIR MAX CUSHIONING',
      price: '$89.99',
      tag: 'nike-run',
    },
    {
      brand: 'HONDA',
      headline: 'CIVIC · 0% APR 60 MONTHS',
      body: '38 MPG HIGHWAY · SIX AIRBAGS · CERTIFIED USED TOO',
      price: 'FROM $13,510',
      tag: 'honda-civic',
    },
  ],
  'painted-wall': [
    {
      brand: 'WIRELESS NETWORK',
      headline: 'CAN YOU HEAR ME NOW',
      body: 'FIVE BARS ACROSS THE CITY · FAMILY PLAN $59.99',
      price: '$59.99/MO',
      tag: 'motorola-razr',
    },
    {
      brand: 'INTERNET',
      headline: 'BROADBAND 1.5 MBPS',
      body: 'ALWAYS ON · FREE MODEM · NO CONTRACT',
      price: '$29.99/MO',
      tag: 'ipod-silhouette',
    },
  ],
  'poster-panel': [
    {
      brand: 'COFFEE',
      headline: 'OPEN AT 5 AM',
      body: 'FIRST 100 CUPS HALF PRICE · WIFI IN EVERY STORE',
      price: '$1.95',
      tag: 'starbucks-mermaid',
    },
    {
      brand: 'MOBILE',
      headline: 'FREE RINGTONES',
      body: 'TEXT 55512 · WEEKLY CHART TONES · TERMS APPLY',
      price: '$2.99/MO',
      tag: 'motorola-razr',
    },
    {
      brand: 'SPORTS',
      headline: 'MARATHON SIGN-UP',
      body: 'RACE ONLINE · SHOES FITTED IN STORE',
      price: '$45 ENTRY',
      tag: 'nike-run',
    },
    {
      brand: 'AUTO',
      headline: 'FUEL ECONOMY EVENT',
      body: 'TEST DRIVE TODAY · 5-YEAR WARRANTY',
      price: '0% APR',
      tag: 'honda-civic',
    },
    {
      brand: 'MUSIC',
      headline: 'DOWNLOAD THE HIT',
      body: '99¢ PER TRACK · MAKE YOUR OWN PLAYLIST',
      price: '99¢',
      tag: 'ipod-silhouette',
    },
    {
      brand: 'HIRING',
      headline: 'NOW HIRING',
      body: 'BARISTAS AND SUPERVISORS · FULL TRAINING',
      price: '$9/HR',
      tag: 'starbucks-mermaid',
    },
  ],
  'newspaper-board': [
    {
      brand: 'METRO',
      headline: 'HOUSING BOOM CONTINUES',
      body: 'INSIDE · RAZR REVIEW AND THE NEW IPOD SHUFFLE',
      price: 'FREE',
      tag: 'motorola-razr',
    },
  ],
  transient: [
    {
      brand: 'SALE',
      headline: 'SIDEWALK SALE 50% OFF',
      body: 'TODAY ONLY · DOORBUSTERS FROM 8 AM',
      price: '50% OFF',
      tag: 'honda-civic',
    },
    {
      brand: 'CAFE',
      headline: 'GRAND OPENING',
      body: 'FREE COFFEE WITH ANY PASTRY · WIFI PASSWORD INSIDE',
      price: 'FREE',
      tag: 'starbucks-mermaid',
    },
    {
      brand: 'HIRING',
      headline: 'APPLY INSIDE',
      body: 'FLEXIBLE HOURS · STUDENTS WELCOME',
      price: '$9/HR',
      tag: 'nike-run',
    },
  ],
}

const ADV_MIX_2005: AdvertisingMix = {
  billboard: 4,
  'painted-wall': 1,
  'poster-panel': 6,
  'newspaper-board': 1,
  transient: 3,
}

const GRAFFITI_2005: GraffitiProfile = {
  state: 'cleaned',
  density: 0.12,
  styles: ['remnant', 'paste-up'],
  messages: ['REMOVED BY CITY', 'WASHED'],
  colours: ['#9aa3ad', '#b7bec6'],
}

/* ------------------------------------------------------------------------- *
 * 2025 — streaming, EV, sustainability
 * ------------------------------------------------------------------------- */

const SHOPS_2025: readonly ShopType[] = [
  {
    id: 'bank-branch',
    label: 'Bank branch',
    category: 'finance',
    names: ['UNION & TRUST BANK', 'CORNERSTONE BANK', 'NORTHSIDE CREDIT UNION'],
    signLines: ['OPEN AN ACCOUNT ONLINE', 'NOTARY · SAFE DEPOSIT', 'APPOINTMENTS 9 TO 5'],
    priceLines: ['4.20% APY SAVINGS', 'NO MONTHLY FEES'],
    awning: 'metal-canopy',
    joinery: 'aluminium',
    shutter: 'open',
  },
  {
    id: 'specialty-coffee',
    label: 'Specialty coffee',
    category: 'food',
    names: ['GREY LOOP COFFEE', 'THIRD WAVE ROASTERS', 'BLOCK & BEAN'],
    signLines: ['SINGLE ORIGIN · POUR OVER', 'OAT · ALMOND · WHOLE', 'ROASTED IN HOUSE'],
    priceLines: ['FLAT WHITE $4.80', 'CORTADO $4.20'],
    awning: 'fabric-logo',
    joinery: 'timber',
    shutter: 'open',
  },
  {
    id: 'delivery-micro-hub',
    label: 'Delivery micro-hub',
    category: 'services',
    names: ['BLOCKFLEET HUB', 'CITYLINK MICRO-HUB', 'LAST MILE CO'],
    signLines: ['PICKUP · DROP-OFF · RETURNS', 'PARCEL LOCKERS OPEN 24/7', 'CARGO BIKE COURIERS'],
    priceLines: ['STANDARD $4.95', 'SAME DAY $9.50'],
    awning: 'rigid-canopy',
    joinery: 'painted-steel',
    shutter: 'roller-grille',
  },
  {
    id: 'boba-tea',
    label: 'Boba tea bar',
    category: 'food',
    names: ['MILK & PEARL', 'BOBA DISTRICT', 'TEA LAB 2025'],
    signLines: ['FRESH TEA · TAPIOCA', 'LESS SUGAR · OAT MILK', 'ORDER AHEAD IN THE APP'],
    priceLines: ['MILK TEA $5.75', 'MATCHA LATTE $6.25'],
    awning: 'solid-canvas',
    joinery: 'aluminium',
    shutter: 'open',
  },
  {
    id: 'grocery-cooperative',
    label: 'Grocery cooperative',
    category: 'food',
    names: ['BLOCK CO-OP MARKET', 'GREENFORK CO-OP', 'NEIGHBOURHOOD GROCERS'],
    signLines: ['LOCAL · ORGANIC · REFILL', 'BRING YOUR OWN BAG', 'BULK GRAINS AND OILS'],
    priceLines: ['OAT MILK $3.40', 'SEASONAL BOX $24'],
    awning: 'canvas-stripe',
    joinery: 'timber',
    shutter: 'open',
  },
  {
    id: 'e-bike-rental',
    label: 'E-bike rental',
    category: 'services',
    names: ['RIDE SHARE E-BIKES', 'PEDAL PLUS', 'GLIDE E-BIKE HUB'],
    signLines: ['E-BIKE RENTAL · REPAIRS', 'HELMETS INCLUDED', 'UNLOCK IN THE APP'],
    priceLines: ['UNLOCK $1.00', 'DAY PASS $19'],
    awning: 'metal-canopy',
    joinery: 'aluminium',
    shutter: 'roller-grille',
  },
]

const ADS_2025: Readonly<Record<AdvertisingKind, readonly AdCopy[]>> = {
  billboard: [
    {
      brand: 'STREAMING',
      headline: '3 MONTHS FREE',
      body: 'ORIGINALS IN 4K · WATCH ON ANY SCREEN · CANCEL ANYTIME',
      price: '$9.99/MO',
      tag: 'streaming-billboard',
    },
    {
      brand: 'CHARGE NETWORK',
      headline: '350 KW ULTRA FAST',
      body: '120 CHARGERS ACROSS THE CITY · TAP TO PAY',
      price: '$0.31/kWh',
      tag: 'ev-charging-network',
    },
    {
      brand: 'ELECTRIC SUV',
      headline: '480 KM RANGE',
      body: 'ZERO TAILPIPE EMISSIONS · FIVE STAR SAFETY',
      price: 'FROM $38,990',
      tag: 'electric-suv',
    },
    {
      brand: 'FINTECH',
      headline: '4.20% APY',
      body: 'SPLIT BILLS AND SAVE AUTOMATICALLY · NO FEES',
      price: 'NO FEES',
      tag: 'fintech-app',
    },
  ],
  'painted-wall': [
    {
      brand: 'PLANT BASED',
      headline: '100% PLANT',
      body: 'ZERO COMPROMISE · CARBON LABELLED MENU',
      price: '$12.99',
      tag: 'plant-based-burger',
    },
    {
      brand: 'CITY CLIMATE',
      headline: 'NET ZERO BY 2030',
      body: 'RETROFIT THE BLOCK · HEAT PUMPS AND SOLAR',
      price: 'GRANTS OPEN',
      tag: 'ev-charging-network',
    },
  ],
  'poster-panel': [
    {
      brand: 'MARKET',
      headline: 'FARMERS MARKET SATURDAY',
      body: '8 AM TO 1 PM · LOCAL GROWERS · BRING A BAG',
      price: 'FREE ENTRY',
      tag: 'plant-based-burger',
    },
    {
      brand: 'LIBRARY',
      headline: 'BORROW A TOOL KIT',
      body: 'REPAIR CAFE EVERY THURSDAY · RIGHT TO REPAIR',
      price: 'FREE',
      tag: 'fintech-app',
    },
    {
      brand: 'TRANSIT',
      headline: 'NIGHT BUS EVERY 20 MIN',
      body: 'CONTACTLESS FARE · LIVE DEPARTURES IN APP',
      price: '$2.75',
      tag: 'ev-charging-network',
    },
    {
      brand: 'DELIVERY',
      headline: 'CARGO BIKE ROUTE',
      body: 'ZERO EMISSION DELIVERIES · LOCKER PICKUP 24/7',
      price: '$4.95',
      tag: 'streaming-billboard',
    },
  ],
  'newspaper-board': [
    {
      brand: 'THE LEDGER',
      headline: 'RENTS COOL, TRANSIT OPENS',
      body: 'INSIDE · EV CHARGING ROLLOUT AND THE STREAMING PRICE WAR',
      price: '$3.50',
      tag: 'ev-charging-network',
    },
    {
      brand: 'CITY DESK',
      headline: 'PLANT-BASED WEEK',
      body: 'SCHOOL MENUS AND THE NEW BURGER JOINTS',
      price: 'FREE',
      tag: 'plant-based-burger',
    },
  ],
  transient: [
    {
      brand: 'CAFE',
      headline: 'SCAN FOR MENU',
      body: 'ORDER AT THE TABLE · OAT MILK NO EXTRA CHARGE',
      price: 'QR',
      tag: 'streaming-billboard',
    },
    {
      brand: 'SHOP',
      headline: 'TAP TO PAY · NO CASH',
      body: 'CONTACTLESS ONLY · RECYCLED PACKAGING',
      price: 'CARD ONLY',
      tag: 'fintech-app',
    },
    {
      brand: 'HUB',
      headline: 'LOCKERS OPEN 24/7',
      body: 'RETURN PARCELS HERE · CARGO BIKE DROP-OFF',
      price: '$4.95',
      tag: 'electric-suv',
    },
  ],
}

const ADV_MIX_2025: AdvertisingMix = {
  billboard: 3,
  'painted-wall': 1,
  'poster-panel': 4,
  'newspaper-board': 2,
  transient: 3,
}

const GRAFFITI_2025: GraffitiProfile = {
  state: 'tags',
  density: 0.3,
  styles: ['tag', 'stencil', 'paste-up'],
  messages: ['ART WALK', 'STAY CURIOUS', 'BLOCK LIFE', 'RIDE FREE'],
  colours: ['#ff5f4a', '#2fb6ff', '#f5f2ea', '#1f6f5a'],
}

/* ------------------------------------------------------------------------- *
 * The table
 * ------------------------------------------------------------------------- */

/** The complete per-era dataset, one record per era of the registry. */
export const STOREFRONT_ERA_TABLE: Readonly<Record<EraId, StorefrontEraData>> = {
  '1945': {
    eraId: '1945',
    label: 'Home front',
    illumination: 'painted',
    secondaryIllumination: 'incandescent',
    typography: LETTERFORMS['1945'],
    inkOnLight: '#2f2418',
    inkOnDark: '#f2e6c9',
    signage: [
      'hand-lettered',
      'enamel-porcelain',
      'painted-brick-wall',
      'channel-glass',
      'war-notice',
      'gold-leaf',
    ],
    shopTypes: SHOPS_1945,
    advertising: ADS_1945,
    advertisingMix: ADV_MIX_1945,
    transientMessages: ['WAR BONDS SOLD HERE', 'GRAND OPENING', 'CLOSED FOR STOCKTAKING', 'HELP WANTED'],
    graffiti: GRAFFITI_1945,
    awningStripes: 6,
    awningProjection: 1.35,
  },
  '1965': {
    eraId: '1965',
    label: 'Mid-century boom',
    illumination: 'neon',
    secondaryIllumination: 'fluorescent',
    typography: LETTERFORMS['1965'],
    inkOnLight: '#123a5c',
    inkOnDark: '#f7f3df',
    signage: [
      'neon-script',
      'plastic-backlit-box',
      'googie-arrow',
      'painted-bulletin',
      'chase-light-marquee',
      'channel-glass',
    ],
    shopTypes: SHOPS_1965,
    advertising: ADS_1965,
    advertisingMix: ADV_MIX_1965,
    transientMessages: ['GRAND OPENING · FREE BALLOONS', '2 BURGERS 60¢', 'BOWLING LEAGUE SIGN-UP', 'SPECIAL TODAY'],
    graffiti: GRAFFITI_1965,
    awningStripes: 8,
    awningProjection: 1.5,
  },
  '1985': {
    eraId: '1985',
    label: 'Neon and video',
    illumination: 'neon',
    secondaryIllumination: 'backlit-vinyl',
    typography: LETTERFORMS['1985'],
    inkOnLight: '#141322',
    inkOnDark: '#f7f2ff',
    signage: [
      'neon-tube',
      'backlit-plastic-box',
      'chase-bulb',
      'vinyl-window-decal',
      'handwritten-flyer',
      'chrome-lettering',
    ],
    shopTypes: SHOPS_1985,
    advertising: ADS_1985,
    advertisingMix: ADV_MIX_1985,
    transientMessages: [
      'CLOSING DOWN SALE',
      'HALF PRICE TAPES TODAY',
      'BINGO NIGHT 7 PM',
      'HELP WANTED · APPLY WITHIN',
    ],
    graffiti: GRAFFITI_1985,
    awningStripes: 4,
    awningProjection: 1.4,
  },
  '2005': {
    eraId: '2005',
    label: 'Dot-com downtown',
    illumination: 'backlit-vinyl',
    secondaryIllumination: 'fluorescent',
    typography: LETTERFORMS['2005'],
    inkOnLight: '#2b2f33',
    inkOnDark: '#ffffff',
    signage: [
      'led-matrix',
      'acrylic-lightbox',
      'vehicle-wrap',
      'vinyl-plotter',
      'projected-gobo',
      'window-graphics',
    ],
    shopTypes: SHOPS_2005,
    advertising: ADS_2005,
    advertisingMix: ADV_MIX_2005,
    transientMessages: [
      'SIDEWALK SALE · 50% OFF',
      'GRAND OPENING · FREE COFFEE',
      'OPEN LATE · 24 HOUR STORE',
      'NOW HIRING · APPLY INSIDE',
    ],
    graffiti: GRAFFITI_2005,
    awningStripes: 3,
    awningProjection: 1.2,
  },
  '2025': {
    eraId: '2025',
    label: 'Electric downtown',
    illumination: 'led',
    secondaryIllumination: 'backlit-vinyl',
    typography: LETTERFORMS['2025'],
    inkOnLight: '#0f2b23',
    inkOnDark: '#f5f2ea',
    signage: [
      'led-video-wall',
      'digital-menu-board',
      'projected-logo',
      'qr-postcard',
      'chalkboard-artisan',
      'vinyl-window-film',
    ],
    shopTypes: SHOPS_2025,
    advertising: ADS_2025,
    advertisingMix: ADV_MIX_2025,
    transientMessages: [
      'SCAN FOR MENU',
      'TAP TO PAY · NO CASH',
      'DOG FRIENDLY · WATER BOWL INSIDE',
      'ORDER ONLINE · PICKUP IN 15 MIN',
    ],
    graffiti: GRAFFITI_2025,
    awningStripes: 2,
    awningProjection: 1.05,
  },
}

/* ------------------------------------------------------------------------- *
 * Loading and derived values
 * ------------------------------------------------------------------------- */

/** True when the value is an era this layer has a storefront table for. */
export function isStorefrontEraId(value: unknown): value is EraId {
  return isKnownEraId(value) && typeof value === 'string' && value in STOREFRONT_ERA_TABLE
}

/**
 * Table entry for one era.
 *
 * The lookup goes through the era registry first, so an unknown id fails with
 * the registry's own error rather than with a missing-key `undefined`.
 */
export function storefrontEraData(eraId: EraId): StorefrontEraData {
  const era = getEra(eraId)
  const data = STOREFRONT_ERA_TABLE[era.id]
  if (data === undefined) {
    throw new RangeError(`No storefront table for era ${era.id}`)
  }
  return data
}

/** True when the era's hero lighting reads as night (sun below the horizon). */
export function isNightLighting(lighting: EraLighting): boolean {
  return lighting.sunElevationDeg < 0 || lighting.timeOfDayHours >= 21 || lighting.timeOfDayHours < 5
}

/**
 * Emissive strength of a period sign.
 *
 * Driven entirely by the era registry: the period's artificial-light intensity
 * (near zero by day in 1945, above one for a 1985 night) times the technology's
 * own yield, halved in daylight so a painted board stays a painted board.
 */
export function signageEmissiveIntensity(
  era: EraDefinition,
  options: { readonly night?: boolean; readonly illumination?: IlluminationKind } = {},
): number {
  const illumination = options.illumination ?? storefrontEraData(era.id).illumination
  const night = options.night ?? isNightLighting(era.lighting)
  const gain = ILLUMINATION_GAIN[illumination]
  const daylight = night ? 1 : DAYLIGHT_EMISSIVE_FRACTION
  return round(clamp(era.lighting.artificialLightIntensity * gain * daylight, 0, 4), 4)
}

/* ------------------------------------------------------------------------- *
 * Module-load guard
 * ------------------------------------------------------------------------- */

/**
 * Validates the table the way `eras.ts` validates the era records: every era is
 * present, has enough period copy to dress a whole block, and the graffiti
 * programme is self-consistent (a disabled state means density zero).
 */
function assertStorefrontTable(): void {
  const problems: string[] = []
  for (const eraId of ERA_IDS) {
    const data = STOREFRONT_ERA_TABLE[eraId]
    if (data === undefined) {
      problems.push(`era ${eraId} is missing from the storefront table`)
      continue
    }
    if (data.eraId !== eraId) {
      problems.push(`era ${eraId} table entry reports id ${data.eraId}`)
    }
    if (data.shopTypes.length < 5) {
      problems.push(`era ${eraId} lists only ${data.shopTypes.length} shop types`)
    }
    const shopIds = new Set<string>()
    for (const shop of data.shopTypes) {
      if (shopIds.has(shop.id)) {
        problems.push(`era ${eraId} repeats shop type ${shop.id}`)
      }
      shopIds.add(shop.id)
      if (shop.names.length === 0 || shop.signLines.length === 0 || shop.priceLines.length === 0) {
        problems.push(`era ${eraId} shop ${shop.id} is missing names, sign lines or prices`)
      }
    }
    if (data.signage.length < 4) {
      problems.push(`era ${eraId} lists only ${data.signage.length} signage terms`)
    }
    if (data.transientMessages.length < 3) {
      problems.push(`era ${eraId} lists only ${data.transientMessages.length} transient messages`)
    }
    let total = 0
    for (const kind of ADVERTISING_KINDS) {
      const copies = data.advertising[kind]
      const mix = data.advertisingMix[kind]
      if (copies.length === 0) {
        problems.push(`era ${eraId} has no ${kind} copy`)
      }
      if (!Number.isInteger(mix) || mix < 0) {
        problems.push(`era ${eraId} has an invalid ${kind} mix (${String(mix)})`)
      }
      total += mix
    }
    if (total === 0) {
      problems.push(`era ${eraId} places no advertising at all`)
    }
    if (data.graffiti.state === 'none' && data.graffiti.density !== 0) {
      problems.push(`era ${eraId} disables graffiti but keeps density ${data.graffiti.density}`)
    }
    if (data.graffiti.density > 0 && data.graffiti.colours.length === 0) {
      problems.push(`era ${eraId} paints graffiti with no colour`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`Invalid storefront era table:\n- ${problems.join('\n- ')}`)
  }
}

assertStorefrontTable()
