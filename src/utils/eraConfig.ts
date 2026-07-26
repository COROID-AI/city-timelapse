export const eraConfig = {
  eras: [
    { year: 1945, buildings: 0, palette: { base: '#8b7a6b', accent: '#d8c28c', windows: '#f0dc9b' }, vehicles: { base: '#2f3a44', accent: '#c1a16a' }, pedestrians: { base: '#2b2b2b', accent: '#a96a4a' }, sign: { base: '#2a2a2a', glow: '#ffd27d' }, streetLight: '#ffe3a6', sky: '#8bb0ff', fog: '#bcd3ff' , audio: { type: 'warEra' as const } },
    { year: 1965, buildings: 1, palette: { base: '#7a7f86', accent: '#c2d6ea', windows: '#d7f4ff' }, vehicles: { base: '#3b4a5a', accent: '#e2b24b' }, pedestrians: { base: '#1f2933', accent: '#7ac7ff' }, sign: { base: '#101010', glow: '#7ae7ff' }, streetLight: '#ffe6a5', sky: '#87c2ff', fog: '#c9e4ff', audio: { type: 'retro' as const } },
    { year: 1985, buildings: 2, palette: { base: '#6f6a70', accent: '#c6a9ff', windows: '#c9b6ff' }, vehicles: { base: '#2f2d35', accent: '#ff7db3' }, pedestrians: { base: '#26202a', accent: '#ffb86b' }, sign: { base: '#0d0d12', glow: '#ff6bd6' }, streetLight: '#ffd8a6', sky: '#8d9cff', fog: '#c3caff', audio: { type: 'synth' as const } },
    { year: 2005, buildings: 3, palette: { base: '#6b7a6d', accent: '#a4f2cf', windows: '#b6ffd8' }, vehicles: { base: '#223338', accent: '#5af0c6' }, pedestrians: { base: '#222a2f', accent: '#63a9ff' }, sign: { base: '#0a0f16', glow: '#44f5a6' }, streetLight: '#ffe9b5', sky: '#7fc7ff', fog: '#c0ebff', audio: { type: 'modern' as const } },
    { year: 2025, buildings: 4, palette: { base: '#6f6e86', accent: '#9be4ff', windows: '#a2f0ff' }, vehicles: { base: '#1b2330', accent: '#7df7ff' }, pedestrians: { base: '#1b2630', accent: '#9bffb2' }, sign: { base: '#060b12', glow: '#7df7ff' }, streetLight: '#fff0c7', sky: '#6da9ff', fog: '#bfe4ff', audio: { type: 'futurish' as const } },
    { year: 2055, buildings: 5, palette: { base: '#5f6677', accent: '#c4a3ff', windows: '#bda6ff' }, vehicles: { base: '#141a25', accent: '#d7a8ff' }, pedestrians: { base: '#141a23', accent: '#b5a6ff' }, sign: { base: '#050810', glow: '#c4a3ff' }, streetLight: '#f7e8ff', sky: '#5f7cff', fog: '#b9d2ff', audio: { type: 'future' as const } },
  ] as const,
}

export type EraDefinition = (typeof eraConfig.eras)[number]

export function getEraPaletteByIndex(indexFloat: number) {
  const clamped = Math.max(0, Math.min(eraConfig.eras.length - 1, indexFloat))
  const lo = Math.floor(clamped)
  const hi = Math.min(eraConfig.eras.length - 1, lo + 1)
  const t = clamped - lo
  return {
    lo,
    hi,
    t,
    eraLo: eraConfig.eras[lo],
    eraHi: eraConfig.eras[hi],
  }
}
