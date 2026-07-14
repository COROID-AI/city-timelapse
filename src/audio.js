// Procedural audio via Web Audio API. AudioContext must be resumed on a user
// gesture, so call resume() from the first click/interaction.
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientNodes = [];
    this.ambientPlaying = false;
  }

  ensureContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  // --- ambient city hum: layered low-frequency drones ---
  startAmbient() {
    this.ensureContext();
    if (!this.ctx || this.ambientPlaying) return;
    this.ambientPlaying = true;
    const ctx = this.ctx;

    // brown-ish noise through a lowpass for a "rumble"
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      output[i] = lastOut * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer; noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 220;
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.12;
    noise.connect(lp); lp.connect(noiseGain); noiseGain.connect(this.master);
    noise.start();
    this.ambientNodes.push(noise);

    // a soft tonal drone
    const drone = ctx.createOscillator();
    drone.type = 'sine'; drone.frequency.value = 58;
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.04;
    drone.connect(droneGain); droneGain.connect(this.master); drone.start();
    this.ambientNodes.push(drone);

    // gentle high shimmer modulated by an LFO (city activity)
    const shimmer = ctx.createOscillator();
    shimmer.type = 'triangle'; shimmer.frequency.value = 880;
    const sg = ctx.createGain(); sg.gain.value = 0.008;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.3;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.006;
    lfo.connect(lfoGain); lfoGain.connect(sg.gain);
    shimmer.connect(sg); sg.connect(this.master);
    shimmer.start(); lfo.start();
    this.ambientNodes.push(shimmer, lfo);
  }

  // --- transition whoosh: filtered noise sweep ---
  playWhoosh() {
    if (!this.ensureNodes()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = 1.6;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, now);
    bp.frequency.exponentialRampToValueAtTime(4000, now + dur * 0.6);
    bp.frequency.exponentialRampToValueAtTime(500, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.32, now + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(now); src.stop(now + dur);
  }

  // --- UI click: short blip ---
  playClick() {
    if (!this.ensureNodes()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(g); g.connect(this.master);
    osc.start(now); osc.stop(now + 0.13);
  }

  ensureNodes() {
    this.ensureContext();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }
}
