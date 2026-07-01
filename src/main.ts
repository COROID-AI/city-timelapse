import './style.css';
import { SceneController } from './scene';
import { Timeline } from './timeline';
import { PeriodYear, nextYear, prevYear } from './eras/types';

// Build the scene before the first paint so 1945 shows on first frame.
const canvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!canvas) throw new Error('#scene canvas not found');

const timelineEl = document.querySelector<HTMLElement>('#timeline-track');
if (!timelineEl) throw new Error('#timeline-track not found');

const timeline = new Timeline(timelineEl);
const scene = new SceneController(canvas);

let audioUnlocked = false;
function unlockAudioOnce(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  scene.unlockAudio();
}

// Wire timeline -> scene
timeline.onChange((year: PeriodYear) => {
  scene.setEra(year);
  unlockAudioOnce();
});

// Reflect era changes (e.g. from arrow keys) back into the timeline.
scene.setOnEraChange((year: PeriodYear) => {
  timeline.setYear(year, false);
});

// Mute toggle
const muteBtn = document.querySelector<HTMLButtonElement>('#mute-btn');
let muted = false;
muteBtn?.addEventListener('click', () => {
  muted = !muted;
  scene.setMuted(muted);
  if (muteBtn) muteBtn.textContent = muted ? '🔇' : '🔊';
  unlockAudioOnce();
});

// Help panel toggle
const helpBtn = document.querySelector<HTMLButtonElement>('#help-btn');
const helpPanel = document.querySelector<HTMLElement>('#help-panel');
helpBtn?.addEventListener('click', () => {
  if (helpPanel) helpPanel.hidden = !helpPanel.hidden;
});

// Keyboard: arrow keys change era, M mutes, WASD handled by camera controller.
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowRight') {
    timeline.setYear(nextYear(timeline.year), true);
    unlockAudioOnce();
  } else if (e.code === 'ArrowLeft') {
    timeline.setYear(prevYear(timeline.year), true);
    unlockAudioOnce();
  } else if (e.code === 'KeyM') {
    muted = !muted;
    scene.setMuted(muted);
    if (muteBtn) muteBtn.textContent = muted ? '🔇' : '🔊';
    unlockAudioOnce();
  }
});

// Unlock audio on first user gesture (any click/keydown).
const gestureUnlock = () => {
  unlockAudioOnce();
  window.removeEventListener('pointerdown', gestureUnlock);
  window.removeEventListener('keydown', gestureUnlock);
};
window.addEventListener('pointerdown', gestureUnlock);
window.addEventListener('keydown', gestureUnlock);

// Start the render loop.
scene.start();
