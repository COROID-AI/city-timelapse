import { useAppStore } from '../state'
import { ERA_PALETTES, type EraId } from '../eras'

let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let isPlaying = false

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const gainNode = audioCtx.createGain()
    gainNode.gain.value = 0.4
    gainNode.connect(audioCtx.destination)
    masterGain = gainNode
  }
  return audioCtx
}

export function createAmbientSound(eraId: EraId) {
  try {
    const ctx = getContext()
    if (ctx.state === 'suspended') ctx.resume()

    const now = ctx.currentTime

    // Ambient pad – filtered noise
    const bufferSize = ctx.sampleRate * 2
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const channelData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      channelData[i] = Math.random() * 2 - 1
    }

    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer
    noise.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = eraId === '2055' ? 800 : eraId === '2025' ? 600 : eraId === '2005' ? 400 : eraId === '1985' ? 300 : eraId === '1965' ? 200 : 150
    filter.Q.value = 1

    const filterGain = ctx.createGain()
    filterGain.gain.value = 0.15

    noise.connect(filter)
    filter.connect(filterGain)
    filterGain.connect(masterGain!)
    noise.start(now)

    // Low tone for era
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = eraId === '2055' ? 110 : eraId === '2025' ? 130.81 : eraId === '2005' ? 146.83 : eraId === '1985' ? 164.81 : eraId === '1965' ? 196 : 164.81
    const oscGain = ctx.createGain()
    oscGain.gain.value = 0.05
    osc.connect(oscGain)
    oscGain.connect(masterGain!)
    osc.start(now)

    // High shimmer for future eras
    if (eraId === '2025' || eraId === '2055') {
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = eraId === '2055' ? 880 : 660
      const osc2Gain = ctx.createGain()
      osc2Gain.gain.value = 0.02
      osc2.connect(osc2Gain)
      osc2Gain.connect(masterGain!)
      osc2.start(now)
    }

    isPlaying = true
  } catch (e) {
    console.warn('Audio init failed:', e)
  }
}

export function setMuted(muted: boolean) {
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.4, audioCtx.currentTime, 0.1)
  }
}

export function disposeAudio() {
  try {
    if (audioCtx) {
      audioCtx.close()
    }
  } catch (e) {
    // ignore
  }
  audioCtx = null
  masterGain = null
  isPlaying = false
}