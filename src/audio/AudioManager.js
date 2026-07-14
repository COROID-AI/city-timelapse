// Fully procedural Web Audio soundscape. No assets. AudioContext is created
// lazily on the first user gesture to satisfy autoplay policies.
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.initialized = false;
    this.ambientNodes = [];
    this.currentEra = null;
    this.blipTimer = 0;
    this.noiseBuffer = null;
  }

  // Must be called from a user gesture (click/keypress).
  init() {
    if (this.initialized) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    this.noiseBuffer = this._makeNoise(2);
    this.initialized = true;
  }

  _makeNoise(seconds) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.9, this.ctx.currentTime + 0.2);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // Start / crossfade the ambient layer for an era.
  applyEra(era, fade = true) {
    this.currentEra = era;
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const old = this.ambientNodes;
    this.ambientNodes = [];
    for (const n of old) {
      try {
        n.gain.gain.cancelScheduledValues(now);
        n.gain.gain.setValueAtTime(n.gain.gain.value, now);
        n.gain.gain.linearRampToValueAtTime(0.0001, now + 1.6);
        safeStop(n.src, now + 1.7);
      } catch (e) { /* ignore */ }
    }

    const a = era.audio;
    const layer = [];

    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.linearRampToValueAtTime(1.0, now + (fade ? 1.5 : 0.2));

    // Drone: two low oscillators
    a.drone.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = a.type;
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.12, now + 2.0);
      osc.connect(g).connect(this.musicGain);
      osc.start();
      layer.push({ src: osc, gain: g });
    });

    // Pad: higher, quieter, slightly detuned with an LFO
    a.pad.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 ? 6 : -6);
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.045, now + 2.5);
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.08 + i * 0.03;
      const lfoG = this.ctx.createGain();
      lfoG.gain.value = 0.02;
      lfo.connect(lfoG).connect(g.gain);
      lfo.start();
      osc.connect(g).connect(this.musicGain);
      osc.start();
      layer.push({ src: osc, gain: g });
    });

    // Filtered noise bed (wind / city hum)
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = a.noiseFreq;
    bp.Q.value = 0.8;
    const ng = this.ctx.createGain();
    ng.gain.value = 0;
    ng.gain.linearRampToValueAtTime(a.noiseGain, now + 2.0);
    noise.connect(bp).connect(ng).connect(this.musicGain);
    noise.start();
    layer.push({ src: noise, gain: ng });

    this.ambientNodes = layer;
    this._blipCfg = a.blip ? a : null;
    this.blipTimer = 0.6;
  }

  update(dt) {
    if (!this.initialized || !this._blipCfg) return;
    this.blipTimer -= dt;
    if (this.blipTimer <= 0) {
      this.blipTimer = 0.8 + Math.random() * 1.4;
      this._blip(this._blipCfg.blipFreq[Math.floor(Math.random() * this._blipCfg.blipFreq.length)]);
    }
  }

  _blip(freq) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.connect(g).connect(this.musicGain);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  // Transition whoosh: filtered noise sweep with gain envelope.
  playWhoosh() {
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, now);
    bp.frequency.exponentialRampToValueAtTime(4000, now + 0.9);
    bp.frequency.exponentialRampToValueAtTime(500, now + 2.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.5, now + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    noise.connect(bp).connect(g).connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 2.5);
  }
}

function safeStop(node, when) {
  try { node.stop(when); } catch (e) { /* already stopped */ }
}
