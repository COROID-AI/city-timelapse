// ─── Click-to-Inspect Interaction Module ──────────────────────────
// Raycasts against era content (storefronts, ads, vehicles, pedestrians,
// buildings), shows a DOM info card with era-specific descriptive copy,
// glides the camera smoothly toward the inspected object, and provides
// hover highlights on inspectable objects. Toggled with the I key.
//
// Constraints:
//   - No modifications to era module internals — uses scene graph traversal.
//   - Camera glide is interruptible by any user input.
//   - Info card never covers the top timeline slider.

import * as THREE from 'three';
import type { EraId } from '../eras.js';
import { getInspectionCopy, type InspectObjectType } from './inspectCopy.js';

// ── Constants ──────────────────────────────────────────────────────

const HOVER_EMISSIVE_INTENSITY = 0.35;
const GLIDE_DURATION_MS = 900;
const GLIDE_MIN_RADIUS = 6;
const GLIDE_MAX_RADIUS = 80;

// ── State ──────────────────────────────────────────────────────────

let _inspectModeEnabled = false;
let _hoveredMesh: THREE.Mesh | null = null;
let _originalMaterials = new Map<THREE.Mesh, THREE.Material>();
let _cameraGlideActive = false;
let _glideStartTime = 0;
let _glideFromPos = new THREE.Vector3();
let _glideToPos = new THREE.Vector3();
let _glideFromTarget = new THREE.Vector3();
let _glideToTarget = new THREE.Vector3();
let _glideAborted = false;

// ── DOM refs (lazy-init) ───────────────────────────────────────────

let _cardEl: HTMLElement | null = null;
let _cardTitleEl: HTMLElement | null = null;
let _cardDescEl: HTMLElement | null = null;
let _cardCloseEl: HTMLElement | null = null;
let _indicatorEl: HTMLElement | null = null;

// ── Helpers: Scene-graph classification ────────────────────────────

/**
 * Walk up the scene graph to classify what kind of object was clicked.
 * Returns an InspectObjectType or null if not inspectable.
 */
function classifyObject(mesh: THREE.Mesh): InspectObjectType | null {
  // Check ancestors for named groups
  let parent: THREE.Object3D | null = mesh.parent;
  while (parent) {
    const name = parent.name || '';

    // Vehicle groups created by TrafficManager contain "car_" prefixed names
    if (name.startsWith('car_') || name === 'trafficLayer' || name.includes('vehicle')) {
      return 'vehicle';
    }

    // Pedestrian groups
    if (name.startsWith('ped_') || name === 'pedestrianLayer' || name.includes('pedestrian')) {
      return 'pedestrian';
    }

    // Named scene groups
    if (name === 'buildings') return 'building';
    if (name === 'streetscape') {
      // Within streetscape, differentiate sub-types by height & geometry
      return classifyStreetscapeItem(mesh);
    }

    parent = parent.parent;
  }

  // Fallback: try to infer from bounding box / geometry
  return inferByGeometry(mesh);
}

/**
 * Classify a streetscape item by examining its world transform and geometry.
 */
function classifyStreetscapeItem(mesh: THREE.Mesh): InspectObjectType {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Billboard: tall, narrow, positioned high up (above ~3 units)
  if (center.y > 3 && size.x > size.z * 0.5) {
    return 'billboard';
  }

  // Wall ad: medium height, low-ish position, relatively flat
  if (center.y < 3 && size.x > size.z && size.y < 2) {
    return 'wall-ad';
  }

  // Default: treat as storefront
  void mesh;
  return 'storefront';
}

/**
 * Infer object type from geometry when no parent group naming is available.
 */
function inferByGeometry(mesh: THREE.Mesh): InspectObjectType | null {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Very tall → likely building
  if (size.y > 5 && size.x > 2) {
    return 'building';
  }

  // Low and wide → vehicle
  if (size.y < 2 && size.x > 1.5 && size.z > 1) {
    return 'vehicle';
  }

  // Small humanoid shape
  if (size.y > 1 && size.y < 2.5 && size.x < 1 && size.z < 1) {
    return 'pedestrian';
  }

  // Flat vertical plane → ad/storefront
  if (size.y > 1 && size.x > 0.5 && size.z < 0.2) {
    return 'billboard';
  }

  void center;
  return null;
}

// ── Hover highlight ────────────────────────────────────────────────

function applyHoverHighlight(mesh: THREE.Mesh): void {
  if (!(mesh instanceof THREE.Mesh)) return;
  if (!(mesh.material instanceof THREE.Material)) return;

  // Store original material once
  if (!_originalMaterials.has(mesh)) {
    _originalMaterials.set(mesh, mesh.material);
  }

  // Clone material to avoid affecting other instances
  const origMat = mesh.material;
  const clone = origMat.clone();
  if ('emissive' in clone) {
    (clone as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x4488ff);
    (clone as THREE.MeshStandardMaterial).emissiveIntensity = HOVER_EMISSIVE_INTENSITY;
  }
  mesh.material = clone;
}

function removeHoverHighlight(mesh: THREE.Mesh): void {
  const orig = _originalMaterials.get(mesh);
  if (orig) {
    mesh.material = orig;
    _originalMaterials.delete(mesh);
  }
}

// ── Camera glide ───────────────────────────────────────────────────

/**
 * Compute a target camera position that frames the given world position
 * nicely from the current spherical angle, but closer.
 */
function computeGlidePosition(worldPos: THREE.Vector3, currentRadius: number): THREE.Vector3 {
  const camDir = new THREE.Vector3();
  camDir.subVectors(_glideFromPos, _glideFromTarget).normalize();

  // New radius: closer but clamped
  const newRadius = Math.max(GLIDE_MIN_RADIUS, Math.min(GLIDE_MAX_RADIUS, currentRadius * 0.4));

  // Position the camera relative to the inspected object
  const newPos = worldPos.clone().add(camDir.clone().multiplyScalar(newRadius));
  // Lift slightly above the object
  newPos.y = Math.max(newPos.y, worldPos.y + newRadius * 0.5);

  return newPos;
}

function startGlide(targetWorldPos: THREE.Vector3, cameraPos: THREE.Vector3, lookAtPoint: THREE.Vector3): void {
  _glideFromPos.copy(cameraPos);
  _glideToPos.copy(computeGlidePosition(targetWorldPos, cameraPos.distanceTo(lookAtPoint)));
  _glideFromTarget.copy(lookAtPoint);
  _glideToTarget.copy(targetWorldPos);
  _glideStartTime = performance.now();
  _glideAborted = false;
  _cameraGlideActive = true;
}

function abortGlide(): void {
  _glideAborted = true;
  _cameraGlideActive = false;
}

// ── DOM info card ──────────────────────────────────────────────────

function ensureCardDOM(): void {
  if (_cardEl) return;

  // Create container
  _cardEl = document.createElement('div');
  _cardEl.className = 'inspect-card';
  _cardEl.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
    max-width: 420px;
    width: calc(100% - 48px);
    background: var(--ui-card-bg, rgba(15, 15, 20, 0.95));
    border: 1px solid var(--ui-border, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    padding: 16px 20px;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: var(--ui-text, #e8e8ec);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    pointer-events: auto;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.25s ease;
    transform: translateX(-50%) translateY(12px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                0 0 0 1px var(--ui-border, rgba(255, 255, 255, 0.05));
  `;

  // Close button
  _cardCloseEl = document.createElement('button');
  _cardCloseEl.className = 'inspect-close';
  _cardCloseEl.textContent = '\u2715';
  _cardCloseEl.style.cssText = `
    position: absolute;
    top: 10px;
    right: 12px;
    background: none;
    border: none;
    color: var(--ui-text-muted, #9a9aa0);
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    line-height: 1;
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  `;
  _cardCloseEl.addEventListener('mouseenter', () => {
    _cardCloseEl!.style.background = 'rgba(255,255,255,0.08)';
    _cardCloseEl!.style.color = '#fff';
  });
  _cardCloseEl.addEventListener('mouseleave', () => {
    _cardCloseEl!.style.background = 'none';
    _cardCloseEl!.style.color = 'var(--ui-text-muted, #9a9aa0)';
  });
  _cardEl.appendChild(_cardCloseEl);

  // Title
  _cardTitleEl = document.createElement('h3');
  _cardTitleEl.className = 'inspect-title';
  _cardTitleEl.style.cssText = `
    margin: 0 0 6px 0;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--ui-text, #e8e8ec);
  `;
  _cardEl.appendChild(_cardTitleEl);

  // Description
  _cardDescEl = document.createElement('p');
  _cardDescEl.className = 'inspect-desc';
  _cardDescEl.style.cssText = `
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--ui-text-muted, #9a9aa0);
  `;
  _cardEl.appendChild(_cardDescEl);

  document.body.appendChild(_cardEl);

  // Bind close action
  _cardCloseEl.addEventListener('click', hideInfoCard);

  // Also allow clicking outside the card to dismiss
  document.addEventListener('click', (e) => {
    if (_cardEl && !_cardEl.contains(e.target as Node)) {
      hideInfoCard();
    }
  });
}

function showInfoCard(objectType: InspectObjectType, eraId: EraId): void {
  ensureCardDOM();

  const copy = getInspectionCopy(eraId, objectType);
  if (!copy) return;

  _cardTitleEl!.textContent = copy.title;
  _cardDescEl!.textContent = copy.description;

  // Apply era accent color to card border
  const eraColors: Record<EraId, string> = {
    '1945': '#7a8a5c',
    '1965': '#e07a3a',
    '1985': '#b040e0',
    '2005': '#4a90d9',
    '2025': '#00d4aa',
  };
  const accentColor = eraColors[eraId] || '#8a8a8a';
  _cardEl!.style.borderColor = accentColor;
  _cardEl!.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px ${accentColor}44`;

  // Animate in
  requestAnimationFrame(() => {
    _cardEl!.style.opacity = '1';
    _cardEl!.style.transform = 'translateX(-50%) translateY(0)';
  });
}

function hideInfoCard(): void {
  if (!_cardEl) return;

  _cardEl.style.opacity = '0';
  _cardEl.style.transform = 'translateX(-50%) translateY(12px)';

  setTimeout(() => {
    if (_cardEl) {
      _cardEl.remove();
      _cardEl = null;
      _cardTitleEl = null;
      _cardDescEl = null;
      _cardCloseEl = null;
    }
  }, 260);
}

// ── Inspect indicator ──────────────────────────────────────────────

function ensureIndicator(): void {
  if (_indicatorEl) return;

  _indicatorEl = document.createElement('div');
  _indicatorEl.className = 'inspect-indicator';
  _indicatorEl.style.cssText = `
    position: fixed;
    top: 72px;
    right: 20px;
    z-index: 200;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: var(--ui-bg, rgba(15, 15, 20, 0.88));
    border: 1px solid var(--ui-border, rgba(255, 255, 255, 0.1));
    color: var(--ui-text-muted, #9a9aa0);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: color 0.2s, border-color 0.2s;
    pointer-events: none;
  `;
  _indicatorEl.textContent = 'Inspect Mode: Off';
  document.body.appendChild(_indicatorEl);
}

function updateIndicator(enabled: boolean): void {
  ensureIndicator();
  _indicatorEl!.textContent = `Inspect Mode: ${enabled ? 'On' : 'Off'}`;
  _indicatorEl!.style.color = enabled
    ? 'var(--ui-accent, #8a8a8a)'
    : 'var(--ui-text-muted, #9a9aa0)';
  _indicatorEl!.style.borderColor = enabled
    ? 'var(--ui-accent, #8a8a8a)'
    : 'var(--ui-border, rgba(255, 255, 255, 0.08))';
}

// ── Public API ─────────────────────────────────────────────────────

/** Options for constructing the inspection system */
export interface InspectionOptions {
  /** The Three.js renderer used for rendering */
  renderer: THREE.WebGLRenderer;
  /** The Three.js scene containing era content */
  scene: THREE.Scene;
  /** Current active era identifier */
  getCurrentEra: () => EraId;
  /** Callback to access the current camera */
  getCamera: () => THREE.PerspectiveCamera;
  /** Render loop callback — called each frame */
  animateCallback: (delta: number) => void;
}

/**
 * Initialize click-to-inspect interaction.
 * Sets up raycasting, keyboard handlers, and the render-loop integration.
 * Returns a dispose function to clean up event listeners and DOM.
 */
export function initInspection(opts: InspectionOptions): () => void {
  const { renderer, scene, getCurrentEra, getCamera, animateCallback } = opts;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const intersects: THREE.Intersection[] = [];

  // Track whether we're inside the canvas for pointer capture
  let isPointerDownInsideCanvas = false;

  // ── Pointer move: hover detection ──────────────────────────────

  const onPointerMove = (e: MouseEvent): void => {
    if (!_inspectModeEnabled) {
      // Reset cursor to default when inspect mode is off
      renderer.domElement.style.cursor = 'default';
      return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, getCamera());
    intersects.length = 0;
    raycaster.intersectObjects(scene.children, true, intersects);

    let foundInspectable: THREE.Mesh | null = null;

    for (const hit of intersects) {
      if (hit.object instanceof THREE.Mesh) {
        const type = classifyObject(hit.object);
        if (type !== null) {
          foundInspectable = hit.object;
          break;
        }
      }
    }

    // Handle hover change
    if (foundInspectable !== _hoveredMesh) {
      // Remove highlight from old hover
      if (_hoveredMesh) {
        removeHoverHighlight(_hoveredMesh);
      }
      _hoveredMesh = foundInspectable;
      if (_hoveredMesh) {
        applyHoverHighlight(_hoveredMesh);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        renderer.domElement.style.cursor = 'default';
      }
    }
  };

  // ── Click: raycast + inspect ───────────────────────────────────

  const onClick = (e: MouseEvent): void => {
    if (!_inspectModeEnabled) return;
    if (e.button !== 0) return; // Only left-click

    // Don't process if clicking on UI elements
    const target = e.target as HTMLElement;
    if (target.closest('.inspect-card') || target.closest('.timeline') || target.closest('.hud-card')) {
      return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, getCamera());
    intersects.length = 0;
    raycaster.intersectObjects(scene.children, true, intersects);

    let foundInspectable: THREE.Mesh | null = null;
    let foundType: InspectObjectType | null = null;

    for (const hit of intersects) {
      if (hit.object instanceof THREE.Mesh) {
        const type = classifyObject(hit.object);
        if (type !== null) {
          foundInspectable = hit.object;
          foundType = type;
          break;
        }
      }
    }

    if (!foundInspectable || !foundType) return;

    // Get world position of the clicked object
    const worldPos = new THREE.Vector3();
    foundInspectable.getWorldPosition(worldPos);

    const eraId = getCurrentEra();
    const camera = getCamera();

    // Compute look-at point from current camera orientation
    const lookAtPoint = new THREE.Vector3();
    camera.getWorldDirection(lookAtPoint);
    lookAtPoint.multiplyScalar(20).add(camera.position);

    // Show info card
    showInfoCard(foundType, eraId);

    // Start camera glide toward the inspected object
    startGlide(worldPos, camera.position.clone(), lookAtPoint);
  };

  // ── Keyboard: I to toggle inspect mode ─────────────────────────

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'i' || e.key === 'I') {
      // Don't toggle if typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      e.preventDefault();
      _inspectModeEnabled = !_inspectModeEnabled;
      updateIndicator(_inspectModeEnabled);

      if (!_inspectModeEnabled) {
        // Clean up hover highlight when turning off
        if (_hoveredMesh) {
          removeHoverHighlight(_hoveredMesh);
          _hoveredMesh = null;
        }
        renderer.domElement.style.cursor = 'default';
      }
    }

    // Escape hides info card
    if (e.key === 'Escape') {
      hideInfoCard();
    }
  };

  // ── Input interrupts camera glide ──────────────────────────────

  const onUserInput = (): void => {
    if (_cameraGlideActive) {
      abortGlide();
    }
    isPointerDownInsideCanvas = false;
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.target === renderer.domElement) {
      isPointerDownInsideCanvas = true;
    }
  };

  // ── Frame loop integration ─────────────────────────────────────

  let _lastFrameTime = performance.now();

  const frameLoop = (now: number): void => {
    const delta = (now - _lastFrameTime) / 1000;
    _lastFrameTime = now;

    // Call existing animation callback
    animateCallback(delta);

    // Update camera glide if active
    if (_cameraGlideActive) {
      // Abort if user interacts
      if (isPointerDownInsideCanvas) {
        abortGlide();
      }

      if (_glideAborted) {
        _cameraGlideActive = false;
      } else {
        const elapsed = now - _glideStartTime;
        const t = Math.min(elapsed / GLIDE_DURATION_MS, 1);
        const eased = t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const camera = getCamera();

        camera.position.lerpVectors(_glideFromPos, _glideToPos, eased);
        camera.position.y = Math.max(camera.position.y, _glideToTarget.y + GLIDE_MIN_RADIUS * 0.3);

        // Look at the glide target
        const lookDir = new THREE.Vector3().subVectors(_glideToTarget, camera.position).normalize();
        camera.lookAt(camera.position.clone().add(lookDir.multiplyScalar(20)));

        if (t >= 1) {
          _cameraGlideActive = false;
          // After glide completes, keep looking at target but let controls take over
          // We don't set the controls target here — the user can freely orbit from here
        }
      }
    }
  };

  // ── Register event listeners ───────────────────────────────────

  renderer.domElement.addEventListener('mousemove', onPointerMove);
  renderer.domElement.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeyDown);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('mousedown', onUserInput);
  window.addEventListener('touchstart', onUserInput, { passive: true });

  // Run the inspection frame loop independently of engine.animate
  const animationId = requestAnimationFrame(function tick(now: number): void {
    frameLoop(now);
    requestAnimationFrame(tick);
  });

  // ── Dispose ────────────────────────────────────────────────────

  return (): void => {
    cancelAnimationFrame(animationId);
    renderer.domElement.removeEventListener('mousemove', onPointerMove);
    renderer.domElement.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeyDown);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('mousedown', onUserInput);
    window.removeEventListener('touchstart', onUserInput);

    // Clean up hover
    if (_hoveredMesh) {
      removeHoverHighlight(_hoveredMesh);
      _hoveredMesh = null;
    }

    // Clean up card
    hideInfoCard();

    // Clean up indicator
    if (_indicatorEl) {
      _indicatorEl.remove();
      _indicatorEl = null;
    }

    _originalMaterials.clear();
    _cameraGlideActive = false;
    _inspectModeEnabled = false;
  };
}
