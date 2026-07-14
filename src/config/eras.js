// Central era configuration. This is the single source of truth that every
// factory / manager reads from, so each era can be fully differentiated.

export const ERAS = {
  '1945': {
    year: 1945,
    name: 'Post-War Recovery',
    description:
      'Low brick tenements line quiet streets. A hazy, sepia afternoon hangs over a city rebuilding itself after the war.',
    sky: { top: '#b39a6e', mid: '#cdb48a', bottom: '#ecdcbe', fog: '#d8c6a0', fogNear: 40, fogFar: 300, sun: '#ffe7bd' },
    light: { ambient: 0.62, ambientColor: '#e6d3aa', hemi: 0.35, hemiSky: '#d9c497', hemiGround: '#6b5a3f', dir: 1.05, dirColor: '#ffe2af', dirPos: [-60, 80, 40] },
    bloom: 0.18,
    building: {
      minHeight: 6, maxHeight: 22, minFoot: 14, maxFoot: 24,
      style: 'brick',
      palette: ['#7c4a32', '#8a5a3c', '#6f4630', '#92634a', '#5f3e2c', '#82513a'],
      roofColor: '#3a2c22',
      window: '#243038', frame: '#3b2c20', neon: null,
    },
    vehicle: { style: 'classic', count: 6, palette: ['#3a3326', '#5a4636', '#2c2a26', '#6b4f33', '#43403a'], speed: 9 },
    pedestrian: { count: 16, palette: ['#4a4036', '#5a4a3c', '#3a332a', '#6b5944', '#463c34'] },
    storefront: { style: 'painted', palette: ['#7a5a38', '#6b4f33', '#5a4636'] },
    ad: { style: 'painted', palette: ['#b5462e', '#3f6b8c', '#c9a23a'] },
    furniture: { lamp: 'iron', trafficLight: false, palette: ['#2c2823'] },
    audio: { drone: [55, 82.5], pad: [110, 165], noiseGain: 0.05, noiseFreq: 380, blip: false, type: 'sine' },
  },

  '1965': {
    year: 1965,
    name: 'Mid-Century Boom',
    description:
      'Concrete and glass rise higher as chrome muscle cars cruise sunlit avenues. Optimism is in the air.',
    sky: { top: '#4f86c4', mid: '#9fc1e0', bottom: '#dceffa', fog: '#bcd2e6', fogNear: 60, fogFar: 360, sun: '#fff4d8' },
    light: { ambient: 0.66, ambientColor: '#dfeaf5', hemi: 0.45, hemiSky: '#bcd6ef', hemiGround: '#6a6557', dir: 1.25, dirColor: '#fff3d4', dirPos: [-40, 90, 60] },
    bloom: 0.3,
    building: {
      minHeight: 10, maxHeight: 34, minFoot: 14, maxFoot: 26,
      style: 'concrete',
      palette: ['#aeb4ba', '#9aa0a6', '#c2c7cc', '#b8b0a0', '#8d9499'],
      roofColor: '#4a4d52',
      window: '#2a3340', frame: '#5a5e63', neon: null,
    },
    vehicle: { style: 'muscle', count: 10, palette: ['#9c1b1b', '#1c3f6b', '#c9a23a', '#e8e8e8', '#2a2a2a', '#3a6b3a'], speed: 13 },
    pedestrian: { count: 22, palette: ['#3a4a6b', '#6b3a3a', '#5a5a5a', '#8a6b3a', '#c9c9c9', '#3a5a3a'] },
    storefront: { style: 'block', palette: ['#c9a23a', '#9aa0a6', '#3a4a6b'] },
    ad: { style: 'neonEarly', palette: ['#e8403a', '#f0c020', '#3aa0e0'] },
    furniture: { lamp: 'steel', trafficLight: true, palette: ['#3a3d42'] },
    audio: { drone: [49, 73.5], pad: [98, 147], noiseGain: 0.07, noiseFreq: 520, blip: false, type: 'sine' },
  },

  '1985': {
    year: 1985,
    name: 'Neon Decade',
    description:
      'Glass towers glow against a magenta dusk. Neon signs flicker as boxy sedans roll through the electric night.',
    sky: { top: '#1c1235', mid: '#5a2070', bottom: '#c83972', fog: '#331a4a', fogNear: 50, fogFar: 320, sun: '#ff5a8a' },
    light: { ambient: 0.42, ambientColor: '#5a3a78', hemi: 0.3, hemiSky: '#6a2a78', hemiGround: '#2a1538', dir: 0.8, dirColor: '#ff7aa0', dirPos: [70, 50, -40] },
    bloom: 0.95,
    building: {
      minHeight: 12, maxHeight: 48, minFoot: 13, maxFoot: 24,
      style: 'glass80s',
      palette: ['#1a2030', '#222a3c', '#161a28', '#2a2540'],
      roofColor: '#10131c',
      window: '#3aa0d0', frame: '#0e1320', neon: { color: '#ff3df0', intensity: 1.0, colors: ['#ff3df0', '#33e0ff', '#ffe000', '#ff5a3a'] },
    },
    vehicle: { style: 'boxy', count: 12, palette: ['#7a1b1b', '#1b3a6b', '#c9a23a', '#dcdcdc', '#2a2a2a', '#4a2a6b'], speed: 14 },
    pedestrian: { count: 26, palette: ['#e8403a', '#3aa0e0', '#ffe000', '#9a3ad0', '#2a2a2a', '#e8e8e8'] },
    storefront: { style: 'neon', palette: ['#ff3df0', '#33e0ff', '#ffe000'] },
    ad: { style: 'neon', palette: ['#ff3df0', '#33e0ff', '#ffe000', '#ff5a3a'] },
    furniture: { lamp: 'modern', trafficLight: true, palette: ['#20242c'] },
    audio: { drone: [41.2, 61.8], pad: [82.4, 123.6], noiseGain: 0.04, noiseFreq: 700, blip: true, blipFreq: [880, 1320], type: 'sawtooth' },
  },

  '2005': {
    year: 2005,
    name: 'Glass Metropolis',
    description:
      'Sleek blue-glass skyscrapers reflect a bright clean sky. Silver sedans and SUVs stream through a modern downtown.',
    sky: { top: '#2f78d5', mid: '#7fb2e8', bottom: '#d6ecff', fog: '#bcdaf2', fogNear: 70, fogFar: 400, sun: '#fff8ea' },
    light: { ambient: 0.7, ambientColor: '#e3eef9', hemi: 0.55, hemiSky: '#cfe6fb', hemiGround: '#73798a', dir: 1.35, dirColor: '#fff6e6', dirPos: [-50, 100, 30] },
    bloom: 0.38,
    building: {
      minHeight: 16, maxHeight: 72, minFoot: 14, maxFoot: 26,
      style: 'glassModern',
      palette: ['#4a6685', '#5a7a98', '#3e5470', '#6486a4'],
      roofColor: '#33414f',
      window: '#7fb2e8', frame: '#33414f', neon: null,
    },
    vehicle: { style: 'sedan', count: 14, palette: ['#b8bcc0', '#3a3d42', '#9aa0a6', '#1c1e22', '#6a7078', '#cfd3d8'], speed: 15 },
    pedestrian: { count: 30, palette: ['#2a3a5a', '#5a5a5a', '#8a8a8a', '#3a3a3a', '#6a4a3a', '#c9c9c9'] },
    storefront: { style: 'backlit', palette: ['#e8edf2', '#9aa0a6', '#2a3a5a'] },
    ad: { style: 'billboard', palette: ['#e8403a', '#3aa0e0', '#ffe000'] },
    furniture: { lamp: 'led', trafficLight: true, palette: ['#2a2d32'] },
    audio: { drone: [44, 66], pad: [88, 132], noiseGain: 0.08, noiseFreq: 600, blip: false, type: 'triangle' },
  },

  '2025': {
    year: 2025,
    name: 'Connected Today',
    description:
      'A golden-hour skyline of mixed-use towers. Electric vehicles glide past towering LED billboards under a warm haze.',
    sky: { top: '#274f86', mid: '#7a6fa0', bottom: '#f0b860', fog: '#c9b486', fogNear: 55, fogFar: 340, sun: '#ffd79a' },
    light: { ambient: 0.6, ambientColor: '#f0d9ad', hemi: 0.5, hemiSky: '#e9c98c', hemiGround: '#5a4a3a', dir: 1.2, dirColor: '#ffd79a', dirPos: [60, 70, -30] },
    bloom: 0.52,
    building: {
      minHeight: 18, maxHeight: 84, minFoot: 14, maxFoot: 26,
      style: 'mixed',
      palette: ['#3a4658', '#4a5a70', '#5e6e84', '#2e3848'],
      roofColor: '#222a36',
      window: '#ffd79a', frame: '#2e3848', neon: { color: '#37e0c0', intensity: 0.5, colors: ['#37e0c0', '#ffd79a'] },
    },
    vehicle: { style: 'ev', count: 16, palette: ['#e8edf2', '#1c1e22', '#3aa0d0', '#cfd3d8', '#2a2d32', '#5ad0a0'], speed: 16 },
    pedestrian: { count: 34, palette: ['#2a3a5a', '#c9c9c9', '#3a3a3a', '#5ad0a0', '#8a8a8a', '#3aa0d0'] },
    storefront: { style: 'led', palette: ['#37e0c0', '#ffd79a', '#e8edf2'] },
    ad: { style: 'led', palette: ['#37e0c0', '#3aa0d0', '#e8403a', '#ffd79a'] },
    furniture: { lamp: 'smart', trafficLight: true, palette: ['#262a30'] },
    audio: { drone: [46.5, 69.75], pad: [93, 139.5], noiseGain: 0.07, noiseFreq: 560, blip: true, blipFreq: [660, 990], type: 'triangle' },
  },

  '2055': {
    year: 2055,
    name: 'Neon Megacity',
    description:
      'Towering arcologies pierce a teal-and-violet sky. Flying vehicles streak between holographic ads under a blazing artificial sun.',
    sky: { top: '#070718', mid: '#0e2a4a', bottom: '#16a0a8', fog: '#0a1a30', fogNear: 45, fogFar: 300, sun: '#9af6ff' },
    light: { ambient: 0.4, ambientColor: '#2a5a78', hemi: 0.45, hemiSky: '#0e3a5a', hemiGround: '#06121f', dir: 1.0, dirColor: '#9af6ff', dirPos: [40, 90, 50] },
    bloom: 1.25,
    building: {
      minHeight: 30, maxHeight: 140, minFoot: 15, maxFoot: 27,
      style: 'future',
      palette: ['#0c1622', '#101c2c', '#0a1320', '#142030'],
      roofColor: '#05080e',
      window: '#16d8e0', frame: '#0a121c', neon: { color: '#16f0ff', intensity: 1.4, colors: ['#16f0ff', '#b04aff', '#9af6ff'] },
    },
    vehicle: { style: 'flying', count: 14, palette: ['#16f0ff', '#b04aff', '#9af6ff', '#0a0f1a', '#3affc0'], speed: 22 },
    pedestrian: { count: 30, palette: ['#16f0ff', '#b04aff', '#0a0f1a', '#3affc0', '#9af6ff'] },
    storefront: { style: 'holo', palette: ['#16f0ff', '#b04aff', '#3affc0'] },
    ad: { style: 'holo', palette: ['#16f0ff', '#b04aff', '#3affc0', '#9af6ff'] },
    furniture: { lamp: 'holo', trafficLight: true, palette: ['#0a1a2a'] },
    audio: { drone: [36.7, 55], pad: [73.4, 110], noiseGain: 0.04, noiseFreq: 900, blip: true, blipFreq: [1046, 1568, 2093], type: 'sine' },
  },
};

export function getEra(key) {
  return ERAS[key];
}
