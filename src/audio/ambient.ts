import { audioEngine } from './engine';

/** Ambient soundscape that plays based on current era */
export function playAmbientForEra(eraKey: string): void {
  if (!audioEngine.isAvailable()) return;
  audioEngine.startAmbience(eraKey);
}

export function stopAmbient(): void {
  audioEngine.stopAmbience();
}
