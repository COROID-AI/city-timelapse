/**
 * Procedural Web Audio engine.
 *
 * Fully synthesised — no audio files — so the scene loads instantly and works
 * offline. Two layers per era:
 *  - Ambient bed: detuned oscillators + filtered noise (era "air").
 *  - Motif: a slow arpeggio on the era's scale/root, era BPM.
 *
 * The engine crossfades between eras as `frame.progress` glides: each era's
 * gain is driven by `variantAlpha(progress, eraIndex)`, so the sound morphs in
 * lockstep with the visuals. The master gain is muted unless the store's
 * `audioEnabled` is true, and the AudioContext is only created/resumed on a
 * user gesture (the mute toggle), respecting browser autoplay policy.
 */
import { ERAS } from '../era/config'
import { variantAlpha } from '../era/math'
import { frame } from '../three/frameState'
import { useCityStore } from './store'

const A4 = 440
const semisToFreq = (root: number, semis: number) =>
  root * Math.pow(2, semis / 12) / A4 * A4

interface EraVoice {
  ambientGain: GainNode
  motifGain: GainNode
  oscillators: OscillatorNode[]
  noiseSource: AudioBufferSourceNode | null
  motifTimer: number
}

class AudioEngine {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  voices: EraVoice[] = []
  enabled = false
  rafId = 0
  started = false

  /** Lazily create the AudioContext + all era voices. Call on user gesture. */
  ensure(): boolean {
    if (this.started) return true
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return false
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0
      this.master.connect(this.ctx.destination)

      for (let i = 0; i < ERAS.length; i++) {
        this.voices.push(this.buildEraVoice(i))
      }
      this.started = true
      return true
    } catch {
      return false
    }
  }

  private buildEraVoice(eraIndex: number): EraVoice {
    const ctx = this.ctx!
    const era = ERAS[eraIndex]
    const ambientGain = ctx.createGain()
    ambientGain.gain.value = 0
    ambientGain.connect(this.master!)

    // Ambient: 2 detuned oscillators through a lowpass filter.
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400 + eraIndex * 80
    filter.Q.value = 0.7
    filter.connect(ambientGain)

    const oscs: OscillatorNode[] = []
    const baseDrone = era.audio.root / 4
    for (let o = 0; o < 2; o++) {
      const osc = ctx.createOscillator()
      osc.type = o === 0 ? 'sine' : 'triangle'
      osc.frequency.value = baseDrone * (1 + o * 0.005)
      osc.detune.value = (o - 0.5) * 6
      osc.connect(filter)
      osc.start()
      oscs.push(osc)
    }

    // Filtered noise bed for "air".
    let noiseSource: AudioBufferSourceNode | null = null
    try {
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const data = noiseBuf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      noiseSource = ctx.createBufferSource()
      noiseSource.buffer = noiseBuf
      noiseSource.loop = true
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'bandpass'
      noiseFilter.frequency.value = 600 + eraIndex * 200
      noiseFilter.Q.value = 0.5
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = 0.04
      noiseSource.connect(noiseFilter).connect(noiseGain).connect(ambientGain)
      noiseSource.start()
    } catch {
      // noise is non-essential
    }

    // Motif: arpeggio gain bus.
    const motifGain = ctx.createGain()
    motifGain.gain.value = 0
    motifGain.connect(this.master!)

    return {
      ambientGain,
      motifGain,
      oscillators: oscs,
      noiseSource,
      motifTimer: Math.random() * 2,
    }
  }

  /** Play a single motif note (short pluck/bell). */
  private playMotifNote(eraIndex: number, freq: number, time: number) {
    const ctx = this.ctx!
    const voice = this.voices[eraIndex]
    if (!voice) return
    const osc = ctx.createOscillator()
    osc.type = eraIndex <= 1 ? 'triangle' : eraIndex <= 3 ? 'sawtooth' : 'sine'
    osc.frequency.value = freq
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(0.3, time + 0.02)
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.5)
    osc.connect(env).connect(voice.motifGain)
    osc.start(time)
    osc.stop(time + 0.6)
  }

  /** Main per-frame update: set era gains from variantAlpha, fire motifs. */
  private update = () => {
    this.rafId = requestAnimationFrame(this.update)
    if (!this.ctx || !this.master) return
    const p = frame.progress
    const dt = frame.dt || 1 / 60

    // Master fade based on enabled state.
    const targetMaster = this.enabled ? 0.35 : 0
    const cur = this.master.gain.value
    this.master.gain.value = cur + (targetMaster - cur) * Math.min(1, dt * 4)

    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i]
      const era = ERAS[i]
      const a = variantAlpha(p, i) * era.audio.gain
      const curAmb = voice.ambientGain.gain.value
      voice.ambientGain.gain.value =
        curAmb + (a * 0.5 - curAmb) * Math.min(1, dt * 3)

      const curMot = voice.motifGain.gain.value
      voice.motifGain.gain.value =
        curMot + (a * 0.5 - curMot) * Math.min(1, dt * 3)

      // Motif scheduling: fire notes at era BPM.
      if (a > 0.1) {
        voice.motifTimer -= dt
        if (voice.motifTimer <= 0) {
          const beatDur = 60 / era.audio.bpm
          voice.motifTimer = beatDur * 2 // play every 2 beats
          const scale = era.audio.scale
          const degree = scale[Math.floor(Math.random() * scale.length)]
          const octave = Math.random() > 0.6 ? 12 : 0
          const freq = semisToFreq(era.audio.root, degree + octave)
          this.playMotifNote(i, freq, this.ctx.currentTime)
        }
      }
    }
  }

  enable() {
    if (!this.ensure()) return
    this.ctx?.resume()
    this.enabled = true
    if (!this.rafId) this.update()
  }

  disable() {
    this.enabled = false
    // Gain ramps to 0 via update loop; stop raf after a short delay.
    window.setTimeout(() => {
      if (!this.enabled && this.rafId) {
        cancelAnimationFrame(this.rafId)
        this.rafId = 0
      }
    }, 600)
  }

  toggle(): boolean {
    if (this.enabled) {
      this.disable()
      return false
    }
    this.enable()
    return true
  }
}

/** Singleton engine instance. */
export const audioEngine = new AudioEngine()

/**
 * Subscribe the audio engine to store changes: enable/disable on toggle.
 */
export function connectAudioToStore() {
  const unsub = useCityStore.subscribe((state) => {
    if (state.audioEnabled) audioEngine.enable()
    else audioEngine.disable()
  })
  return unsub
}
