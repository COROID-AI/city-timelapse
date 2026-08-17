import { audioEngine } from './engine';

/** Play a UI click sound */
export function playClick(): void {
  if (!audioEngine.isAvailable()) return;
  audioEngine.playClick();
}

/** Play era transition whoosh */
export function playWhoosh(): void {
  if (!audioEngine.isAvailable()) return;
  audioEngine.playWhoosh();
}
