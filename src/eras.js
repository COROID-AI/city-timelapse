// Era definitions for the city timelapse. Each era fully describes the look of
// the entire block (sky, fog, lights, buildings, vehicles, pedestrians, etc.).
export const ERAS = [
  {
    year: 1945,
    label: 'Post-War',
    sky: { top: '#876234', bottom: '#e4cd99' },
    fog: { color: '#c9b285', near: 28, far: 165 },
    sun: { color: '#ffb066', intensity: 1.7, pos: [52, 40, 30] },
    ambient: { color: '#cba87a', intensity: 0.55 },
    hemi: { sky: '#b89466', ground: '#4a3826', intensity: 0.7 },
    exposure: 1.05,
    bloom: 0.35,
    starfield: false,
    night: false,
    windowEmissive: 0.55,
    ground: { ground: '#6b5a3e', road: '#4f473e', sidewalk: '#8a7c66', line: '#cdbf9a' },
    building: {
      style: 'brick', floorsMin: 2, floorsMax: 5, roof: 'pitched',
      palette: ['#8a5a3c', '#6f4630', '#7d5238', '#9a6b48', '#5e3f2c'],
      accent: ['#d8c4a0', '#b08850'],
      roughness: 0.92, metalness: 0.0
    },
    vehicle: { type: 'vintage', palette: ['#3a332b', '#6b2222', '#243a5a', '#7a6a3a', '#2a2a2a'] },
    pedestrian: { palette: ['#6b6048', '#7a5a44', '#5a5040', '#8a7060', '#4a4438'], accent: ['#c9b48a'] },
    billboard: { style: 'painted' },
    lamp: { style: 'gas', color: '#ffd28a' }
  },
  {
    year: 1965,
    label: 'The Boom',
    sky: { top: '#5a86b0', bottom: '#c6d6e4' },
    fog: { color: '#aebcc8', near: 34, far: 175 },
    sun: { color: '#fff0d0', intensity: 1.85, pos: [55, 52, 24] },
    ambient: { color: '#b8c4d0', intensity: 0.6 },
    hemi: { sky: '#88a8c8', ground: '#5a5048', intensity: 0.8 },
    exposure: 1.0,
    bloom: 0.45,
    starfield: false,
    night: false,
    windowEmissive: 0.4,
    ground: { ground: '#4a4a48', road: '#33333a', sidewalk: '#9a9a96', line: '#d8d2b0' },
    building: {
      style: 'concrete', floorsMin: 4, floorsMax: 9, roof: 'flat',
      palette: ['#9a9a96', '#8a8a86', '#a8a8a4', '#7e7e7a'],
      accent: ['#c25a3a', '#3a6a8a', '#caa050'],
      roughness: 0.85, metalness: 0.05
    },
    vehicle: { type: 'classic', palette: ['#a8a8a8', '#3a3a3a', '#8a2a2a', '#2a4a6a', '#caa050'] },
    pedestrian: { palette: ['#c2a23a', '#3a7a7a', '#8a4a2a', '#e0d8c0', '#5a3a6a'], accent: ['#2a2a2a'] },
    billboard: { style: 'neon' },
    lamp: { style: 'cobra', color: '#fff0c8' }
  },
  {
    year: 1985,
    label: 'Neon Dusk',
    sky: { top: '#241638', bottom: '#d44c78' },
    fog: { color: '#3a1f4a', near: 26, far: 145 },
    sun: { color: '#ff5a8a', intensity: 1.35, pos: [62, 22, -34] },
    ambient: { color: '#5a3868', intensity: 0.5 },
    hemi: { sky: '#6a3878', ground: '#2a1830', intensity: 0.6 },
    exposure: 1.05,
    bloom: 1.0,
    starfield: false,
    night: true,
    windowEmissive: 0.95,
    ground: { ground: '#2a2230', road: '#1a1622', sidewalk: '#3a3245', line: '#ff5ab0' },
    building: {
      style: 'glass', floorsMin: 8, floorsMax: 16, roof: 'antenna',
      palette: ['#1d6a78', '#265a8a', '#2a4878', '#1a5a6a'],
      accent: ['#ff2bd6', '#22e0ff', '#ffd23a'],
      roughness: 0.25, metalness: 0.6
    },
    vehicle: { type: 'retro80', palette: ['#2a2a3a', '#8a1a3a', '#1a3a5a', '#c8c8d0', '#3a2a4a'] },
    pedestrian: { palette: ['#ff2bd6', '#22e0ff', '#2a2a4a', '#9a2a6a', '#2a4a8a'], accent: ['#ffffff'] },
    billboard: { style: 'neon' },
    lamp: { style: 'cobra', color: '#ff8ac8' }
  },
  {
    year: 2005,
    label: 'Glass Age',
    sky: { top: '#2a6cd0', bottom: '#aed4f4' },
    fog: { color: '#b4d0e8', near: 50, far: 205 },
    sun: { color: '#fff8e8', intensity: 2.2, pos: [42, 62, 40] },
    ambient: { color: '#c8d8ec', intensity: 0.7 },
    hemi: { sky: '#8ec0ec', ground: '#6a6058', intensity: 0.9 },
    exposure: 1.0,
    bloom: 0.6,
    starfield: false,
    night: false,
    windowEmissive: 0.5,
    ground: { ground: '#3a3a3e', road: '#2c2c32', sidewalk: '#a0a0a4', line: '#e8e4c0' },
    building: {
      style: 'curtain', floorsMin: 12, floorsMax: 26, roof: 'flat',
      palette: ['#3a6a9a', '#4a7aa8', '#2a5a8a', '#5a8ab0'],
      accent: ['#c8ccd4', '#8aa0b4'],
      roughness: 0.18, metalness: 0.75
    },
    vehicle: { type: 'modern', palette: ['#c8c8cc', '#2a2a2e', '#3a4a5a', '#8a1a1a', '#1a3a5a'] },
    pedestrian: { palette: ['#2a3a5a', '#5a5a5a', '#8a3a3a', '#2a2a2a', '#3a6a4a'], accent: ['#ffffff'] },
    billboard: { style: 'led' },
    lamp: { style: 'modern', color: '#fff4d8' }
  },
  {
    year: 2025,
    label: 'Smart City',
    sky: { top: '#3a72a8', bottom: '#bcd6e8' },
    fog: { color: '#c0d2e0', near: 46, far: 195 },
    sun: { color: '#fff6e2', intensity: 2.0, pos: [46, 58, 34] },
    ambient: { color: '#c2d2e4', intensity: 0.75 },
    hemi: { sky: '#9ec4e8', ground: '#6a6258', intensity: 0.95 },
    exposure: 1.0,
    bloom: 0.75,
    starfield: false,
    night: false,
    windowEmissive: 0.6,
    ground: { ground: '#34343a', road: '#26262a', sidewalk: '#b0b0b4', line: '#6ad7ff' },
    building: {
      style: 'modern', floorsMin: 15, floorsMax: 30, roof: 'green',
      palette: ['#d8dce2', '#c4cad2', '#e4e8ee', '#aab2bc'],
      accent: ['#22e0ff', '#2a8ad8'],
      roughness: 0.3, metalness: 0.5
    },
    vehicle: { type: 'ev', palette: ['#e8e8ec', '#2a2a30', '#2a4a6a', '#1a6a5a', '#c8202a'] },
    pedestrian: { palette: ['#2a2a30', '#5a4a3a', '#3a4a5a', '#8a8a90', '#2a6a5a'], accent: ['#6ad7ff'] },
    billboard: { style: 'led' },
    lamp: { style: 'led', color: '#eaf4ff' }
  },
  {
    year: 2055,
    label: 'Neo Future',
    sky: { top: '#04050d', bottom: '#0a1430' },
    fog: { color: '#060a18', near: 10, far: 95 },
    sun: { color: '#6080ff', intensity: 0.6, pos: [30, 52, -22] },
    ambient: { color: '#182038', intensity: 0.35 },
    hemi: { sky: '#182a4a', ground: '#0a0a14', intensity: 0.4 },
    exposure: 0.92,
    bloom: 1.4,
    starfield: true,
    night: true,
    windowEmissive: 1.5,
    ground: { ground: '#0a0a12', road: '#06060c', sidewalk: '#141420', line: '#00e5ff' },
    building: {
      style: 'cyber', floorsMin: 18, floorsMax: 36, roof: 'cyber',
      palette: ['#0c0e16', '#10131d', '#0a0c14', '#141826'],
      accent: ['#00e5ff', '#ff2bd6', '#7a3aff'],
      roughness: 0.4, metalness: 0.7
    },
    vehicle: { type: 'hover', palette: ['#1a1f30', '#2a1030', '#101a2a', '#302a10', '#0a1a2a'] },
    pedestrian: { palette: ['#1a1a24', '#241428', '#141a28', '#2a1a1a'], accent: ['#00e5ff', '#ff2bd6'] },
    billboard: { style: 'holographic' },
    lamp: { style: 'pylon', color: '#00e5ff' }
  }
];

export const ERA_COUNT = ERAS.length;
export const ERA_YEARS = ERAS.map((e) => e.year);
export const getEra = (i) => ERAS[i];
