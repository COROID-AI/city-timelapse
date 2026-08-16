import { ERAS, EraKey } from '../eras/eraData';
import * as THREE from 'three';

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentAmbientSource: AudioBufferSourceNode | null = null;
let ambientGain: GainNode | null = null;

// Master volume UI
const createMasterVolumeSlider = () => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '10px';
  container.style.left = '10px';
  container.style.zIndex = '1000';
  container.style.background = 'rgba(0,0,0,0.5)';
  container.style.padding = '10px';
  container.style.borderRadius = '5px';

  const label = document.createElement('label');
  label.textContent = 'Master Volume: ';
  label.style.color = 'white';
  label.style.fontFamily = 'Arial, sans-serif';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '100';
  slider.value = '100';
  slider.style.width = '150px';

  slider.addEventListener('input', (event) => {
    const target = event.currentTarget as HTMLInputElement;
    if (masterGain) {
      masterGain.gain.value = parseFloat(target.value) / 100;
    }
  });

  container.appendChild(label);
  container.appendChild(slider);
  document.body.appendChild(container);

  return slider;
};

// Initialize audio system on first user interaction
const initAudioSystem = () => {
  if (audioContext) return;

  audioContext = new AudioContext();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(audioContext.destination);

  // Create master volume slider
  createMasterVolumeSlider();

  // Load initial era ambient (2025)
  loadAndPlayAmbient('2025' as EraKey);
};

// Load and play an ambient track
const loadAndPlayAmbient = async (eraKey: EraKey) => {
  const trackUrl = ERAS[eraKey].ambientAudioTrack;
  const response = await fetch(trackUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await audioContext!.decodeAudioData(arrayBuffer);

  // Stop current ambient source if exists
  if (currentAmbientSource) {
    currentAmbientSource.stop();
  }

  ambientGain = audioContext!.createGain();
  ambientGain.gain.value = 1.0;
  ambientGain.connect(masterGain!);

  currentAmbientSource = audioContext!.createBufferSource();
  currentAmbientSource.buffer = buffer;
  currentAmbientSource.loop = true;
  currentAmbientSource.connect(ambientGain);
  currentAmbientSource.start();
};

// Crossfade between two ambient tracks
const crossfadeAmbient = async (fromEra: EraKey, toEra: EraKey, duration: number = 2) => {
  if (!audioContext) return;

  // Load both tracks
  const [fromBuffer, toBuffer] = await Promise.all([
    loadAudioTrack(ERAS[fromEra].ambientAudioTrack),
    loadAudioTrack(ERAS[toEra].ambientAudioTrack)
  ]);

  // Create gain nodes for crossfading
  const fromGain = audioContext.createGain();
  const toGain = audioContext.createGain();

  fromGain.gain.value = 1.0;
  toGain.gain.value = 0.0;

  fromGain.connect(masterGain!);
  toGain.connect(masterGain!);

  // Create buffer sources
  const fromSource = audioContext.createBufferSource();
  const toSource = audioContext.createBufferSource();

  fromSource.buffer = fromBuffer;
  toSource.buffer = toBuffer;
  fromSource.loop = true;
  toSource.loop = true;

  fromSource.connect(fromGain);
  toSource.connect(toGain);

  // Start both sources
  fromSource.start();
  toSource.start();

  // Set up crossfade over duration
  const startTime = audioContext.currentTime;

  // Fade out from track
  fromGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  // Fade in to track
  toGain.gain.exponentialRampToValueAtTime(1.0, startTime + duration);

  // After crossfade, stop the from source and clean up
  setTimeout(() => {
    fromSource.stop();
    fromGain.disconnect();
    toGain.disconnect();
    // Keep the to source as current ambient
    if (ambientGain) {
      ambientGain.disconnect();
    }
    ambientGain = toGain;
    currentAmbientSource = toSource;
  }, duration * 1000);
};

// Load and decode an audio track
const loadAudioTrack = async (url: string): Promise<AudioBuffer> => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await audioContext!.decodeAudioData(arrayBuffer);
};

// Spatial audio panner for 3D positioning
const createSpatialPanner = (): PannerNode => {
  if (!audioContext) throw new Error('Audio context not initialized');
  const panner = audioContext.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.maxDistance = 100;
  panner.rolloffFactor = 1;
  panner.connect(masterGain!);
  return panner;
};

// Play event-triggered SFX with spatial positioning
export const playSpatialSFX = async (buffer: AudioBuffer, position: THREE.Vector3) => {
  if (!audioContext) return;

  const source = audioContext.createBufferSource();
  const panner = createSpatialPanner();

  source.buffer = buffer;
  source.connect(panner);

  // Update panner position
  panner.setPosition(position.x, position.y, position.z);

  source.start();

  // Clean up after playback
  source.stop(audioContext.currentTime + buffer.duration);
};

// Public API
export const audioSystem = {
  init: initAudioSystem,
  crossfadeAmbient,
  playSpatialSFX,
  createSpatialPanner
};

// Initialize on first user interaction
window.addEventListener('click', initAudioSystem, { once: true });
window.addEventListener('touchstart', initAudioSystem, { once: true });