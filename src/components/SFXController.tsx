import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  effectiveIndex: number
  isTransitioning: boolean
  reducedMotion: boolean
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}

type Voice = {
  osc: OscillatorNode
  gain: GainNode
}

export function SFXController({ effectiveIndex, isTransitioning, reducedMotion }: Props) {
  const [enabled, setEnabled] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const ambRef = useRef<Voice | null>(null)
  const noiseRef = useRef<Voice | null>(null)
  const lastEraRef = useRef<number>(Math.round(effectiveIndex))

  const target = useMemo(() => clamp(effectiveIndex, 0, 5), [effectiveIndex])

  useEffect(() => {
    const onFirstGesture = () => setEnabled(true)
    window.addEventListener('pointerdown', onFirstGesture, { once: true })
    return () => window.removeEventListener('pointerdown', onFirstGesture)
  }, [])

  useEffect(() => {
    if (!enabled || reducedMotion) return

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return

    const ctx = new AudioCtx()
    audioCtxRef.current = ctx

    const ambOsc = ctx.createOscillator()
    const ambGain = ctx.createGain()
    ambOsc.type = 'sawtooth'
    ambOsc.frequency.value = 55
    ambGain.gain.value = 0.0
    ambOsc.connect(ambGain).connect(ctx.destination)
    ambOsc.start()

    // Noise layer (wind / traffic)
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.45
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuf
    noise.loop = true

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.0
    noise.connect(noiseGain).connect(ctx.destination)
    noise.start()

    ambRef.current = { osc: ambOsc, gain: ambGain }
    noiseRef.current = { osc: ambOsc, gain: noiseGain } // placeholder osc, gain is real

    const resume = async () => {
      if (ctx.state !== 'running') await ctx.resume()
    }
    resume().catch(() => {})

    return () => {
      try {
        ambOsc.stop()
        noise.stop()
      } catch {}
      ctx.close().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reducedMotion])

  useEffect(() => {
    const ctx = audioCtxRef.current
    const amb = ambRef.current
    const noise = noiseRef.current
    if (!ctx || !amb || !noise || reducedMotion) return

    const era = Math.round(target)
    const t = target - era

    // Map eras to amb frequency/timbre.
    const baseFreq = [48, 62, 74, 86, 98, 112][era] ?? 55
    const noiseAmt = [0.18, 0.22, 0.17, 0.21, 0.26, 0.15][era] ?? 0.2

    // Smoothly adjust.
    const now = ctx.currentTime
    const freq = baseFreq * (1 - 0.04 * t)
    amb.osc.frequency.setTargetAtTime(freq, now, 0.08)

    // Volume varies during transitions for a "whoosh" feel.
    const baseAmbVol = 0.06
    const baseNoiseVol = 0.04
    const transitionBoost = isTransitioning ? 0.35 : 1

    amb.gain.gain.setTargetAtTime(baseAmbVol * transitionBoost, now, 0.2)
    ;(noise.gain as GainNode).gain.setTargetAtTime(baseNoiseVol * noiseAmt * transitionBoost, now, 0.2)

    const last = lastEraRef.current
    if (last !== era) {
      lastEraRef.current = era
      // short accent transient
      const spike = ctx.createOscillator()
      const spikeGain = ctx.createGain()
      spike.type = 'triangle'
      spike.frequency.value = 260 + era * 18
      spikeGain.gain.value = 0
      spike.connect(spikeGain).connect(ctx.destination)

      spikeGain.gain.setValueAtTime(0, now)
      spikeGain.gain.linearRampToValueAtTime(0.09, now + 0.03)
      spikeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
      spike.start(now)
      spike.stop(now + 0.26)
    }
  }, [isTransitioning, reducedMotion, target])

  // No visible UI; controller is side-effect only.
  return null
}
