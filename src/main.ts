import './styles.css';

import { WebGLRenderer } from 'three';
import { AppComposition, type CompositionOptions } from './app/composition';
import type { RendererLike } from './core/sceneRuntime';
import { ERAS } from './eras/eraSystem';

/**
 * main.ts — browser entrypoint for the composed city-block timelapse.
 *
 * Owned by the app-composition task. This entry defers the WebGL renderer and
 * canvas creation (src/app/composition.ts stays headless and DOM-free), mounts
 * the composed TimelineUI into the HUD top bar, starts the runtime frame loop
 * and wires resize/dispose/audio-unlock lifecycle. The era slider, SFX and
 * navigation are all registered and driven by AppComposition.
 */

function setHudState(message: string, isError = false): void {
  const overlay = document.querySelector<HTMLElement>('#hud-overlay');
  const messageEl = document.querySelector<HTMLElement>('#hud-message');
  overlay?.classList.toggle('is-error', isError);
  if (messageEl) messageEl.textContent = message;
}

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene-canvas');
  if (!canvas) throw new Error('Missing #scene-canvas element in the HUD shell.');

  setHudState('Initializing WebGL…');

  let webgl: WebGLRenderer;
  try {
    webgl = new WebGLRenderer({ canvas, antialias: true });
  } catch (error) {
    setHudState(
      `WebGL unavailable — ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
    return;
  }

  // Keep the runtime WebGL-agnostic: adapt WebGLRenderer to RendererLike and
  // let CSS own layout (setSize(updateStyle = false)).
  const adapter: RendererLike = {
    domElement: canvas,
    setSize: (width, height) => webgl.setSize(width, height, false),
    render: (scene, camera) => webgl.render(scene, camera),
    dispose: () => webgl.dispose(),
  };

  // Audio is optional: only attach when the browser actually provides Web
  // Audio so environments without it boot with a silent (still functional)
  // scene. Construction is allowed pre-gesture; resume() unlocks it below.
  const audioOptions: Pick<CompositionOptions, 'audioContextFactory'> =
    typeof AudioContext === 'function' ? { audioContextFactory: () => new AudioContext() } : {};

  const composition = new AppComposition({
    renderer: adapter,
    ...audioOptions,
  });

  // Replace the scaffold placeholder slider with the real five-stop
  // TimelineUI (1945, 1965, 1985, 2005, 2025) mounted into the HUD top bar.
  const timelineSlot = document.querySelector<HTMLElement>('.timeline');
  if (!timelineSlot) {
    setHudState('Timeline slot missing in the HUD shell.', true);
    return;
  }
  timelineSlot.replaceChildren();
  composition.timeline.mount(timelineSlot);
  composition.timeline.update(composition.eraSystem.getState());

  // HUD shell is ready; the loading message becomes the live era title.
  document.querySelector<HTMLElement>('.hud-badge')?.replaceChildren('1945–2025');
  setHudState(
    `${ERAS[composition.eraSystem.getState().current].title} — drag the timeline`,
  );

  composition.runtime.resize(canvas.clientWidth || 960, canvas.clientHeight || 640);
  composition.runtime.start();

  window.addEventListener('resize', () => composition.resize());
  window.addEventListener('beforeunload', () => composition.dispose());

  // Browsers gate audio on a user gesture: unlock on the first interaction.
  const unlockAudio = (): void => {
    void composition.unlockAudio().catch(() => undefined);
    window.removeEventListener('pointerdown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
}

boot();
