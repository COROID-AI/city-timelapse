function getAudioContext(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    return new AC()
  } catch {
    return null
  }
}

export function playStepSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 200
    const gain = ctx.createGain()
    gain.gain.value = 0.03
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.1)
    osc.onended = () => ctx.close().catch(() => {})
  } catch {
    ctx.close().catch(() => {})
  }
}

export function playTrafficNoise(eraId: string) {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const bufferSize = ctx.sampleRate * 0.5
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = eraId === '1945' ? 300 : eraId === '1965' ? 500 : eraId === '1985' ? 800 : 1200
    const gain = ctx.createGain()
    gain.gain.value = 0.1
    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start()
    source.onended = () => ctx.close().catch(() => {})
  } catch {
    ctx.close().catch(() => {})
  }
}