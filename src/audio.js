// ============================================================
//  Procedural Audio Engine — Web Audio API, zero external assets
//  Generates era-appropriate ambient beds, SFX, and UI sounds.
// ============================================================

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.ambient = null;       // { gain, stop() }
    this.trafficNoise = null;
    this.eraBed = null;
    this.currentEra = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    // gentle master compression
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.master.disconnect();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.2);
    }
  }

  // ---- One-shot UI / transition SFX ----
  blip(freq = 660, dur = 0.12, type = 'sine', vol = 0.18) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  whoosh(vol = 0.3) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    // filtered noise burst
    const dur = 0.9;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.sin((i / data.length) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.Q.value = 1.2;
    filt.frequency.setValueAtTime(300, t);
    filt.frequency.exponentialRampToValueAtTime(3500, t + dur * 0.6);
    filt.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t);
  }

  // shimmer on era arrival
  shimmer(freqs = [523, 659, 784, 1046]) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const start = t + i * 0.06;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      o.connect(g); g.connect(this.master);
      o.start(start); o.stop(start + 0.75);
    });
  }

  // ---- Ambient bed per era ----
  setEra(era) {
    if (!this.ctx) return;
    this.currentEra = era;
    // fade out old bed
    if (this.eraBed) {
      const old = this.eraBed;
      old.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
      setTimeout(() => { try { old.stop(); } catch (e) {} }, 1200);
      this.eraBed = null;
    }
    const bed = this._buildBed(era);
    this.eraBed = bed;
    bed.gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    bed.gain.gain.setTargetAtTime(bed.target, this.ctx.currentTime, 1.2);
    bed.start();
  }

  _buildBed(era) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.connect(this.master);
    const parts = [];
    const target = 0.5;

    // Pad: 2-3 detuned oscillators forming a chord appropriate to era mood
    const padGain = ctx.createGain(); padGain.gain.value = 0.12; padGain.connect(out);
    const chord = this._eraChord(era);
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    padFilter.connect(padGain);
    chord.forEach((freq, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      o.detune.value = (i - 1) * 6;
      const og = ctx.createGain(); og.gain.value = 1 / chord.length;
      o.connect(og); og.connect(padFilter);
      parts.push(o);
      // slow LFO on filter for movement
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 400;
    lfo.connect(lfoG); lfoG.connect(padFilter.frequency);
    parts.push(lfo);

    // Sub rumble (city ambience low-end)
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 48;
    const subG = ctx.createGain(); subG.gain.value = 0.08;
    sub.connect(subG); subG.connect(out);
    parts.push(sub);

    // Wind / traffic noise layer
    const noise = this._noiseLayer(era, out);

    return {
      gain: out, target, parts, noise,
      start: () => parts.forEach(p => { try { p.start(); } catch (e) {} }),
      stop: () => {
        parts.forEach(p => { try { p.stop(); } catch (e) {} });
        if (noise) { try { noise.src.stop(); } catch (e) {} }
      },
    };
  }

  _eraChord(era) {
    // mood → chord (frequencies in Hz)
    const chords = {
      1945: [196.0, 246.94, 293.66],          // G major-ish, warm
      1965: [220.0, 277.18, 329.63, 415.30],   // A major, bright
      1985: [146.83, 174.61, 220.0, 233.08],   // D minor, moody
      2005: [261.63, 329.63, 392.0, 493.88],   // C major sus
      2025: [293.66, 369.99, 440.0, 587.33],   // D add9, clean
      2055: [329.63, 440.0, 554.37, 659.25],   // E, airy shimmer
    };
    return chords[era.id] || chords[2025];
  }

  _noiseLayer(era, out) {
    const ctx = this.ctx;
    const dur = 4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    const profile = {
      1945: { f: 500, q: 0.7 },
      1965: { f: 700, q: 0.8 },
      1985: { f: 1200, q: 1.0 },
      2005: { f: 800, q: 0.6 },
      2025: { f: 600, q: 0.5 },
      2055: { f: 450, q: 0.5 },
    }[era.id] || { f: 700, q: 0.7 };
    filt.frequency.value = profile.f; filt.Q.value = profile.q;
    const g = ctx.createGain(); g.gain.value = 0.04;
    // slow movement
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.02;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(filt); filt.connect(g); g.connect(out);
    try { lfo.start(); } catch (e) {}
    return { src, stop: () => { try { lfo.stop(); } catch (e) {} } };
  }

  // occasional passing-car / horn / flyby sounds, called from loop
  ambientTick(era) {
    if (!this.ctx || this.muted) return;
    if (Math.random() < 0.012) {
      // doppler car pass
      this._carPass(era);
    }
    if (Math.random() < 0.004) {
      this._distantHonk(era);
    }
  }

  _carPass(era) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 2.2;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.sin((i / data.length) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env * 0.5;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.Q.value = 0.8;
    const baseF = era.id >= 2025 ? 180 : 240;
    filt.frequency.setValueAtTime(baseF * 0.6, t);
    filt.frequency.exponentialRampToValueAtTime(baseF * 1.8, t + dur * 0.5);
    filt.frequency.exponentialRampToValueAtTime(baseF * 0.6, t + dur);
    const g = ctx.createGain(); g.gain.value = 0.06;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.setValueAtTime(-0.8, t); pan.pan.linearRampToValueAtTime(0.8, t + dur); }
    src.connect(filt); filt.connect(g);
    if (pan) g.connect(pan), pan.connect(this.master); else g.connect(this.master);
    src.start(t); src.stop(t + dur);
  }

  _distantHonk(era) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [0, 0.18].forEach(off => {
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = 'square'; o.frequency.value = era.id >= 2025 ? 0 : (180 + Math.random() * 60);
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.exponentialRampToValueAtTime(0.05, t + off + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.35);
      o.connect(g); g.connect(this.master);
      o.start(t + off); o.stop(t + off + 0.4);
    });
  }
}
