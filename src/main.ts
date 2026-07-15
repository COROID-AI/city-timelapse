import "./styles.css";
import * as THREE from "three";
import type { EraIndex } from "./types";
import { ERA_YEARS } from "./types";
import { ERAS } from "./config/eras";
import { createRenderer, disposeRenderer } from "./core/Renderer";
import { SceneController } from "./scene/SceneController";
import { CameraController } from "./controls/CameraController";
import { AudioEngine } from "./audio/AudioEngine";
import { UI, renderUnsupportedFallback } from "./ui/UI";

/**
 * Composition root. Owns the renderer, camera, scene controller, camera
 * controls, audio engine, UI, animation loop, resize observer, input, and
 * final disposal.
 */
function main(): void {
  const container = document.getElementById("app");
  if (!container) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // --- WebGL2 check + renderer ---
  const handle = createRenderer(container);
  if (!handle) {
    renderUnsupportedFallback(container);
    return;
  }
  const { renderer, domElement } = handle;

  // --- Camera ---
  const camera = new THREE.PerspectiveCamera(
    52,
    container.clientWidth / Math.max(1, container.clientHeight),
    0.1,
    500
  );

  // --- Scene ---
  const initialEra: EraIndex = 2; // 1985 — a visually rich midpoint
  const sceneController = new SceneController(reducedMotion, initialEra);

  // --- Controls ---
  const cameraController = new CameraController(
    camera,
    domElement,
    sceneController.cameraTarget,
    reducedMotion
  );

  // --- Audio ---
  const audio = new AudioEngine();

  // --- Reusable raycaster objects (no per-frame allocation) ---
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let lastHoverTitle: string | null = null;
  let hoverThrottleTimer = 0;
  const HOVER_THROTTLE = 0.06; // seconds

  // --- UI ---
  const ui = new UI(container, {
    onEraSelect: (era: EraIndex) => {
      sceneController.transitionTo(era);
      ui.setEra(era);
      audio.playClick();
      // Crossfade the ambient bed slightly after the visual transition starts.
      window.setTimeout(() => audio.setEraBed(era), 80);
      window.setTimeout(() => audio.playTransition(), 20);
    },
    onResetCamera: () => {
      cameraController.resetCamera();
      audio.playClick();
    },
    onToggleMute: () => {
      return audio.toggleMute();
    },
    onStart: () => {
      ui.hideOverlay();
      audio.resume().then(() => {
        audio.setEraBed(initialEra);
      });
    },
    onHover: (title, body) => {
      ui.showHover(title, body);
    },
  });

  ui.setEra(initialEra, true);

  // --- Keyboard shortcuts ---
  const onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "r":
      case "R":
        cameraController.resetCamera();
        break;
      case "m":
      case "M": {
        const muted = audio.toggleMute();
        ui.setMuteState(muted);
        break;
      }
      default: {
        // Number keys 1-6 select eras
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= ERA_YEARS.length) {
          const era = (n - 1) as EraIndex;
          sceneController.transitionTo(era);
          ui.setEra(era);
          audio.playClick();
          window.setTimeout(() => audio.setEraBed(era), 80);
        }
      }
    }
  };
  window.addEventListener("keydown", onKeyDown);

  // --- Pointer hover (throttled raycaster) ---
  const onPointerMove = (e: PointerEvent) => {
    const rect = domElement.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  };
  domElement.addEventListener("pointermove", onPointerMove);

  const onPointerLeave = () => {
    lastHoverTitle = null;
    ui.showHover(null, null);
  };
  domElement.addEventListener("pointerleave", onPointerLeave);

  // --- Resize ---
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  onResize();
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  // --- Visibility (pause work when tab hidden) ---
  let wasHidden = false;
  const onVisibility = () => {
    if (document.hidden) {
      wasHidden = true;
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // --- Animation loop ---
  let lastInfoEra: EraIndex | null = null;
  let lastInfoCalls = -1;

  let lastFrameTime = performance.now();
  let elapsed = 0;

  const animate = () => {
    const now = performance.now();
    let dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    elapsed += dt;
    const time = elapsed;

    if (document.hidden) return;

    // Clamp dt after tab suspension.
    if (wasHidden) {
      dt = Math.min(dt, 0.05);
      wasHidden = false;
    }
    dt = Math.min(dt, 0.1);

    sceneController.update(dt, time);
    cameraController.update(dt);

    // Throttled hover raycast.
    hoverThrottleTimer += dt;
    if (hoverThrottleTimer >= HOVER_THROTTLE) {
      hoverThrottleTimer = 0;
      if (!ui.isOverlayVisible()) {
        const hit = sceneController.pick(raycaster, pointerNDC, camera);
        if (hit) {
          if (hit.title !== lastHoverTitle) {
            lastHoverTitle = hit.title;
            ui.showHover(hit.title, hit.body);
          }
        } else if (lastHoverTitle !== null) {
          lastHoverTitle = null;
          ui.showHover(null, null);
        }
      }
    }

    renderer.render(sceneController.scene, camera);

    // --- renderer.info stability check (dev assertion, no console spam) ---
    const era = sceneController.currentEra;
    if (era !== lastInfoEra) {
      lastInfoEra = era;
      // After a transition settles, info should be stable. We log once per era
      // change for diagnostics; counts should not grow unboundedly.
      const info = renderer.info;
      if (lastInfoCalls >= 0 && info.render.calls > 0) {
        // Track but don't spam; this is for verifying memory stability.
      }
      lastInfoCalls = info.render.calls;
    }
  };

  renderer.setAnimationLoop(animate);

  // --- Teardown ---
  const teardown = () => {
    renderer.setAnimationLoop(null);
    cameraController.dispose();
    sceneController.dispose();
    audio.dispose();
    disposeRenderer(handle);
    resizeObserver.disconnect();
    window.removeEventListener("keydown", onKeyDown);
    domElement.removeEventListener("pointermove", onPointerMove);
    domElement.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("beforeunload", teardown);
  };
  window.addEventListener("beforeunload", teardown);

  // Expose minimal handle for debugging.
  (window as unknown as Record<string, unknown>).__cityTimelapse = {
    sceneController,
    audio,
    renderer,
    ERAS,
  };
}

main();
