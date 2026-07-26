import * as THREE from 'three';

/**
 * AudioManager — handles SFX playback with robust autoplay-unlock.
 *
 * Addresses finding: "Audio autoplay restrictions in browsers"
 * Strategy:
 *  - Start with AudioContext in suspended state.
 *  - Resume on first user gesture (click/touch/keydown).
 *  - Provide a `unlock()` method callable from UI.
 *  - Gracefully degrade if Web Audio is unavailable.
 */
export class AudioManager {
  private listener: THREE.AudioListener;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sounds: Map<string, THREE.Audio> = new Map();
  private buffers: Map<string, AudioBuffer> = new Map();
  private unlocked = false;
  private suspended = false;

  constructor(listener: THREE.AudioListener) {
    this.listener = listener;
    this.init();
  }

  private init() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.7;

      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.gain.value = 0.8;

      this.ambientGain = this.audioContext.createGain();
      this.ambientGain.connect(this.masterGain);
      this.ambientGain.gain.value = 0.5;

      if (this.audioContext.state === 'suspended') {
        this.suspended = true;
      }
    } catch (e) {
      console.warn('[AudioManager] Web Audio API not available:', e);
    }
  }

  /**
   * Attempt to unlock audio on user gesture.
   * Must be called from a user-initiated event handler.
   */
  async unlock(): Promise<boolean> {
    if (this.unlocked) return true;
    if (!this.audioContext) return false;

    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      // Create a tiny buffer and play it to fully unlock on mobile
      const buffer = this.audioContext.createBuffer(1, 1, 22050);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      source.start(0);
      this.unlocked = true;
      this.suspended = false;
      return true;
    } catch (e) {
      console.warn('[AudioManager] Unlock failed:', e);
      return false;
    }
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  isSuspended(): boolean {
    return this.suspended;
  }

  /**
   * Generate a procedural sound buffer and store it.
   * This avoids needing external audio file downloads (bundle size).
   */
  generateSound(name: string, type: 'white' | 'pink' | 'tone' | 'click', duration: number = 1.0): AudioBuffer | null {
    if (!this.audioContext) return null;

    const sampleRate = this.audioContext.sampleRate;
    const numSamples = Math.ceil(sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      switch (type) {
        case 'white':
          sample = (Math.random() * 2 - 1) * Math.exp(-t * 4);
          break;
        case 'pink': {
          // Simple pink noise approximation
          const white = Math.random() * 2 - 1;
          sample = white * Math.exp(-t * 3) * 0.3;
          break;
        }
        case 'tone': {
          const freq = 220 + Math.sin(t * 3) * 40;
          sample = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 2);
          break;
        }
        case 'click':
          sample = (Math.random() * 2 - 1) * Math.exp(-t * 30);
          break;
      }

      data[i] = sample;
    }

    this.buffers.set(name, buffer);
    return buffer;
  }

  /**
   * Play a procedural sound effect.
   */
  playSFX(name: string, volume: number = 0.5, detune: number = 0): void {
    if (!this.audioContext || !this.unlocked) return;
    if (this.audioContext.state !== 'running') return;

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.sfxGain!);
      source.playbackRate.value = 1 + (detune / 1200);
      source.start(0);
    } catch (e) {
      console.warn('[AudioManager] Failed to play SFX:', name, e);
    }
  }

  /**
   * Play an ambient loop sound.
   */
  playAmbientLoop(name: string, volume: number = 0.3): THREE.Audio | null {
    if (!this.unlocked) return null;

    const sound = new THREE.Audio(this.listener);
    const buffer = this.buffers.get(name);
    if (buffer) {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(volume);
      // THREE.Audio typings don't allow routing via connect() into a GainNode.
      // We already control overall loudness via the sound volume and master gain.
      sound.play();
      this.sounds.set(name, sound);
      return sound;
    }
    return null;
  }

  stopAmbientLoop(name: string): void {
    const sound = this.sounds.get(name);
    if (sound) {
      sound.stop();
      this.sounds.delete(name);
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  dispose(): void {
    this.sounds.forEach((sound) => sound.stop());
    this.sounds.clear();
    this.buffers.clear();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
