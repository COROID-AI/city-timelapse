const GAIN_NEAR_SILENCE = 0.0001;
function hashEra(eraId) {
    // Tiny stable hash (deterministic across runs)
    let h = 2166136261;
    for (let i = 0; i < eraId.length; i++) {
        h ^= eraId.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function makeLCG(seed) {
    let s = seed >>> 0;
    return () => {
        // Numerical Recipes LCG
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
function clampSample(x) {
    // Soft clip to prevent harsh clipping.
    return Math.tanh(x * 2) * 0.5;
}
function generateEraBuffer({ eraId, sampleRate, seconds, }) {
    const len = Math.floor(sampleRate * seconds);
    // Create a buffer through AudioContext as requested by the plan.
    const ctx = new AudioContext({ sampleRate });
    const buffer = ctx.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);
    const rand = makeLCG(hashEra(eraId));
    const twoPi = Math.PI * 2;
    // Fade edges to reduce loop boundary clicks
    const fadeSeconds = 0.05;
    const fadeLen = Math.max(1, Math.floor(sampleRate * fadeSeconds));
    // Precompute a few deterministic transient events per buffer
    const times = [];
    const addRandomTimes = (count, minT, maxT, ampBase, type) => {
        for (let i = 0; i < count; i++) {
            const t = minT + rand() * (maxT - minT);
            const amp = ampBase * (0.5 + rand());
            times.push({ t, amp, type });
        }
    };
    // Deterministic music cadence parameters
    let tempoBpm = 90;
    let baseF = 220;
    switch (eraId) {
        case '1945':
            tempoBpm = 72;
            baseF = 110;
            addRandomTimes(18, 0.2, seconds - 0.2, 0.08, 'clink');
            break;
        case '1965':
            tempoBpm = 104;
            baseF = 146;
            addRandomTimes(12, 0.2, seconds - 0.2, 0.06, 'clink');
            break;
        case '1985':
            tempoBpm = 118;
            baseF = 185;
            addRandomTimes(16, 0.2, seconds - 0.2, 0.09, 'beep');
            addRandomTimes(4, 0.3, seconds - 0.3, 0.14, 'ring');
            break;
        case '2005':
            tempoBpm = 96;
            baseF = 164;
            addRandomTimes(10, 0.25, seconds - 0.25, 0.06, 'click');
            break;
        case '2025':
            tempoBpm = 92;
            baseF = 196;
            addRandomTimes(10, 0.2, seconds - 0.2, 0.08, 'notif');
            break;
    }
    const beatSec = 60 / tempoBpm;
    // Pink-ish noise state
    let pink0 = 0;
    let pink1 = 0;
    let pink2 = 0;
    // Loopable rhythm cycle aligned to measureBeats to reduce boundary discontinuity
    const measureBeats = 8;
    const measureSec = beatSec * measureBeats;
    const rhythmCycle = seconds - (seconds % measureSec);
    const cycle = Math.max(2, rhythmCycle);
    for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        const tc = t % cycle;
        // Room tone
        let sample = 0;
        const white = (rand() - 0.5) * 2;
        // Pink-ish noise
        pink0 = 0.99886 * pink0 + white * 0.0555179;
        pink1 = 0.99332 * pink1 + white * 0.0750759;
        pink2 = 0.98598 * pink2 + white * 0.153852;
        const pink = pink0 + pink1 + pink2 + white * 0.016898;
        sample += pink * 0.02;
        sample += Math.sin(twoPi * 0.25 * tc) * 0.005;
        // Era-specific ambience
        switch (eraId) {
            case '1945': {
                // Distant war radio: slow AM + mid tone noise
                const am = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(twoPi * 0.07 * tc));
                const radio = (pink * 0.5 + Math.sin(twoPi * 0.33 * tc) * 0.15) * 0.06 * am;
                // Street horses: periodic clop-like pulses
                const clopPeriod = beatSec * 1.15;
                const clopPhase = (tc % clopPeriod) / clopPeriod;
                const clopEnv = Math.exp(-clopPhase * 9) * Math.pow(1 - clopPhase, 1.8);
                const clop = clopEnv * (Math.sin(twoPi * 2.0 * tc) + 0.5 * Math.sin(twoPi * 3.2 * tc)) * 0.08;
                sample += radio;
                sample += clop;
                break;
            }
            case '1965': {
                // Faint rock music: detuned oscillators with tremolo
                const trem = 0.65 + 0.35 * Math.sin(twoPi * 0.9 * tc);
                const riff = 0.35 * Math.sin(twoPi * (baseF * 2) * tc) +
                    0.25 * Math.sin(twoPi * (baseF * 2.01) * tc + 1.2);
                sample += riff * 0.02 * trem;
                // Soda fountain: fizzy bursts
                const fizzyEnv = 0.5 + 0.5 * Math.sin(twoPi * (1 / (beatSec * 2)) * tc);
                const fizzy = (pink * 0.5 + white * 0.5) * 0.04 * Math.pow(fizzyEnv, 4);
                sample += fizzy;
                break;
            }
            case '1985': {
                // Synth pop: two-note motif
                const step = Math.floor(tc / beatSec) % 8;
                const scale = [0, 3, 5, 7, 10, 7, 5, 3];
                const semis = scale[step];
                const freq = baseF * Math.pow(2, semis / 12);
                const freq2 = freq * 1.5;
                const gate = 0.2 + 0.8 * Math.pow(Math.sin(Math.PI * (tc / beatSec)), 2);
                const synth = (Math.sin(twoPi * freq * tc) * 0.35 + Math.sin(twoPi * freq2 * tc + 0.7) * 0.25) * 0.08 * gate;
                sample += synth;
                break;
            }
            case '2005': {
                // Indie playlist: lo-fi chord pulses
                const beat = Math.floor(tc / beatSec) % 16;
                const chordIndex = Math.floor(beat / 4);
                const chordBase = [baseF, baseF * 1.25, baseF * 1.5, baseF * 1.125][chordIndex % 4];
                const chord = Math.sin(twoPi * chordBase * tc) * 0.05 + Math.sin(twoPi * chordBase * 2 * tc + 0.4) * 0.02;
                const strum = 0.15 + 0.85 * Math.exp(-((tc % beatSec) / beatSec) * 6);
                sample += chord * strum;
                // Espresso hiss
                const hissSwell = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(twoPi * 0.05 * tc));
                const hiss = pink * 0.03 * hissSwell;
                sample += hiss;
                break;
            }
            case '2025': {
                // Lo-fi beats
                const bpm = tempoBpm;
                const beatLocal = tc / (60 / bpm);
                const beatInt = Math.floor(beatLocal);
                const frac = beatLocal - beatInt;
                const isKick = beatInt % 2 === 0;
                if (isKick) {
                    const f0 = 85 - 30 * frac;
                    const kickEnv = Math.exp(-frac * 14);
                    sample += Math.sin(twoPi * f0 * tc) * kickEnv * 0.09;
                }
                const isSnare = beatInt % 4 === 1;
                if (isSnare) {
                    const snEnv = Math.exp(-frac * 18);
                    sample += (white * 0.6 + pink * 0.4) * snEnv * 0.03;
                }
                sample += (Math.sin(twoPi * 0.55 * tc) + Math.sin(twoPi * 0.22 * tc + 1.4)) * 0.01;
                break;
            }
        }
        // Transient events
        for (let j = 0; j < times.length; j++) {
            const ev = times[j];
            const dt = t - ev.t;
            const wrappedDt = dt < 0 ? dt + seconds : dt;
            if (wrappedDt < 0 || wrappedDt > 0.25)
                continue;
            const env = Math.exp(-wrappedDt * 30);
            switch (ev.type) {
                case 'clink': {
                    const f = 5000 + 2000 * rand();
                    sample += Math.sin(twoPi * f * wrappedDt) * ev.amp * env;
                    break;
                }
                case 'beep': {
                    const f = 1500 + 500 * rand();
                    sample += Math.sin(twoPi * f * wrappedDt) * ev.amp * env;
                    sample += white * ev.amp * 0.06 * env;
                    break;
                }
                case 'ring': {
                    const f = 440 + 40 * rand();
                    const mod = 0.6 + 0.4 * Math.sin(twoPi * 6 * wrappedDt);
                    sample += Math.sin(twoPi * f * wrappedDt * mod) * ev.amp * env;
                    break;
                }
                case 'click': {
                    sample += white * ev.amp * env;
                    break;
                }
                case 'notif': {
                    const fStart = 1200;
                    const fEnd = 2400;
                    const f = fStart + (fEnd - fStart) * (wrappedDt / 0.08);
                    sample += Math.sin(twoPi * f * wrappedDt) * ev.amp * env;
                    break;
                }
            }
        }
        let out = clampSample(sample);
        // Edge fade for loop continuity
        if (i < fadeLen) {
            out *= i / fadeLen;
        }
        else if (i > len - fadeLen) {
            out *= (len - i) / fadeLen;
        }
        data[i] = out;
    }
    void ctx.close().catch(() => { });
    return buffer;
}
class SfxMixerImpl {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.currentGain = null;
        this.currentSource = null;
        this.currentEraId = null;
        this.pendingEra = null;
        this.pendingDurationMs = 1500;
        this.unlocked = false;
        this.muted = false;
        this.defaultMasterGain = 0.65;
        this.buffers = new Map();
        this.muteListeners = new Set();
    }
    isMuted() {
        return this.muted;
    }
    isUnlocked() {
        return this.unlocked;
    }
    subscribeMute(listener) {
        this.muteListeners.add(listener);
        return () => this.muteListeners.delete(listener);
    }
    emitMute() {
        for (const l of this.muteListeners)
            l(this.muted);
    }
    ensureAudioContext(sampleRate) {
        if (this.ctx)
            return;
        const AudioCtx = (window.AudioContext || window.webkitAudioContext);
        this.ctx = new AudioCtx({ sampleRate });
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? GAIN_NEAR_SILENCE : this.defaultMasterGain;
        this.masterGain.connect(this.ctx.destination);
    }
    async unlock() {
        if (this.unlocked)
            return false;
        this.ensureAudioContext();
        if (!this.ctx || !this.masterGain)
            return false;
        try {
            await this.ctx.resume();
        }
        catch {
            // ignore
        }
        this.unlocked = true;
        if (this.pendingEra) {
            const era = this.pendingEra;
            this.pendingEra = null;
            this.setEra(era, this.pendingDurationMs);
            return true;
        }
        return false;
    }
    setMuted(muted) {
        this.muted = muted;
        this.emitMute();
        if (!this.ctx || !this.masterGain)
            return;
        const now = this.ctx.currentTime;
        const target = muted ? GAIN_NEAR_SILENCE : this.defaultMasterGain;
        try {
            this.masterGain.gain.cancelScheduledValues(now);
            const startVal = Math.max(this.masterGain.gain.value, GAIN_NEAR_SILENCE);
            this.masterGain.gain.setValueAtTime(startVal, now);
            this.masterGain.gain.exponentialRampToValueAtTime(target, now + 0.12);
        }
        catch {
            this.masterGain.gain.linearRampToValueAtTime(target, now + 0.12);
        }
    }
    toggleMuted() {
        this.setMuted(!this.muted);
    }
    getOrCreateBuffer(eraId, sampleRate) {
        const existing = this.buffers.get(eraId);
        if (existing)
            return existing;
        // Keep a fixed length loop.
        const seconds = 8;
        const buffer = generateEraBuffer({ eraId, sampleRate, seconds });
        this.buffers.set(eraId, buffer);
        return buffer;
    }
    setEra(eraId, durationMs = 1500) {
        if (!this.unlocked) {
            this.pendingEra = eraId;
            this.pendingDurationMs = durationMs;
            return;
        }
        this.ensureAudioContext();
        if (!this.ctx || !this.masterGain)
            return;
        if (this.currentEraId === eraId && this.currentSource && this.currentGain)
            return;
        const durationSec = durationMs / 1000;
        const now = this.ctx.currentTime;
        const buffer = this.getOrCreateBuffer(eraId, this.ctx.sampleRate);
        const nextSource = this.ctx.createBufferSource();
        nextSource.buffer = buffer;
        nextSource.loop = true;
        const nextGain = this.ctx.createGain();
        nextGain.gain.value = GAIN_NEAR_SILENCE;
        nextSource.connect(nextGain);
        nextGain.connect(this.masterGain);
        // Next fade in
        try {
            nextGain.gain.cancelScheduledValues(now);
            nextGain.gain.setValueAtTime(GAIN_NEAR_SILENCE, now + 0.01);
            const targetUp = this.muted ? GAIN_NEAR_SILENCE : this.defaultMasterGain;
            nextGain.gain.exponentialRampToValueAtTime(targetUp, now + durationSec);
        }
        catch {
            const targetUp = this.muted ? GAIN_NEAR_SILENCE : this.defaultMasterGain;
            nextGain.gain.linearRampToValueAtTime(targetUp, now + durationSec);
        }
        // Current fade out + stop
        if (this.currentGain && this.currentSource) {
            const current = this.currentGain;
            try {
                current.gain.cancelScheduledValues(now);
                const currentVal = Math.max(current.gain.value, GAIN_NEAR_SILENCE);
                current.gain.setValueAtTime(currentVal, now);
                current.gain.exponentialRampToValueAtTime(GAIN_NEAR_SILENCE, now + durationSec);
            }
            catch {
                current.gain.linearRampToValueAtTime(GAIN_NEAR_SILENCE, now + durationSec);
            }
            const stopAt = now + durationSec + 0.02;
            try {
                this.currentSource.stop(stopAt);
            }
            catch {
                // ignore
            }
        }
        nextSource.start(now);
        this.currentSource = nextSource;
        this.currentGain = nextGain;
        this.currentEraId = eraId;
    }
}
// Singleton export matching the plan text: SfxMixer.setEra(id)
export const SfxMixer = new SfxMixerImpl();
