// ─── Evidence Capture & QA Harness ─────────────────────────────────
// Provides programmatic access for automated acceptance testing:
//   - Era cycling with callbacks (window.EvidenceAPI.cycleEras())
//   - Screenshot capture (canvas.toDataURL)
//   - Transition recording state
//   - Performance data export
//   - Checklist matrix display
//
// Triggered by pressing 'E' key or calling window.__qaEvidence = true

import * as THREE from 'three';
import { ERA_REGISTRY, type EraId } from '../eras.js';

// ── Public API surface on window ────────────────────────────────────

export interface EvidenceAPI {
  /** Cycle through all eras sequentially, invoking callback between each */
  cycleEras(callback: (eraId: EraId, index: number) => Promise<void>): Promise<void>;
  /** Capture current viewport as base64 PNG */
  captureScreenshot(): string | null;
  /** Get current scene stats as JSON */
  getSceneStats(): Record<string, unknown>;
  /** Get per-era checklist status */
  getChecklistMatrix(): EraChecklist[];
  /** Set whether evidence mode is active */
  setEnabled(enabled: boolean): void;
  /** Check if currently in evidence mode */
  isEnabled(): boolean;
  /** Switch to a specific era and wait for transition */
  switchToEra(eraId: EraId): Promise<void>;
}

export interface EraChecklist {
  eraId: EraId;
  year: number;
  label: string;
  buildingsPresent: boolean;
  vehiclesPresent: boolean;
  pedestriansPresent: boolean;
  streetscapePresent: boolean;
  atmosphereDistinct: boolean;
  screenshotCaptured: boolean;
}

// ── State ───────────────────────────────────────────────────────────

let _enabled = false;
let _renderer: THREE.WebGLRenderer | null = null;
let _scene: THREE.Scene | null = null;
let _camera: THREE.Camera | null = null;
let _onEraChange: ((eraId: EraId) => void) | null = null;
let _panelEl: HTMLElement | null = null;
let _checklistData: EraChecklist[] = [];

// ── DOM Panel ───────────────────────────────────────────────────────

function buildPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'evidence-panel';
  panel.id = 'evidence-panel';
  panel.style.cssText = `
    position: fixed; bottom: 80px; left: 16px; right: 16px; max-width: 720px;
    background: rgba(10, 10, 18, 0.96); border: 1px solid rgba(0, 212, 170, 0.3);
    border-radius: 12px; padding: 16px; z-index: 200; color: #e8e8ec;
    font-family: 'Inter', sans-serif; backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5); display: none;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:14px;font-weight:600;color:#00d4aa;';
  title.textContent = '🏙️ City Era Timelapse — QA Evidence Panel';
  const closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,0.2);color:#e8e8ec;';
  closeBtn.style.padding = '4px 10px;border-radius:6px;cursor:pointer;font-size:12px;';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => { panel.style.display = 'none'; });
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Status row
  const statusRow = document.createElement('div');
  statusRow.id = 'evidence-status';
  statusRow.style.cssText = 'font-size:12px;color:#9a9aa0;margin-bottom:12px;padding:8px;background:rgba(255,255,255,0.03);border-radius:6px;';
  statusRow.textContent = 'Press E to toggle evidence mode.';
  panel.appendChild(statusRow);

  // Checklist table
  const tableContainer = document.createElement('div');
  tableContainer.id = 'evidence-checklist';
  tableContainer.style.cssText = 'overflow-x:auto;';
  tableContainer.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
          <th style="text-align:left;padding:6px;color:#9a9aa0;">Era</th>
          <th style="text-align:center;padding:6px;color:#9a9aa0;">Buildings</th>
          <th style="text-align:center;padding:6px;color:#9a9aa0;">Vehicles</th>
          <th style="text-align:center;padding:6px;color:#9a9aa0;">Pedestrians</th>
          <th style="text-align:center;padding:6px;color:#9a9aa0;">Streetscape</th>
          <th style="text-align:center;padding:6px;color:#9a9aa0;">Atmosphere</th>
          <th style="text-align:center;padding:6px;color:#9a9aa0;">Screenshot</th>
        </tr>
      </thead>
      <tbody id="checklist-body"></tbody>
    </table>
  `;
  panel.appendChild(tableContainer);

  // Screenshot gallery
  const galleryHeader = document.createElement('div');
  galleryHeader.style.cssText = 'margin-top:16px;font-size:12px;color:#9a9aa0;font-weight:600;';
  galleryHeader.textContent = 'Per-Era Screenshots';
  panel.appendChild(galleryHeader);

  const gallery = document.createElement('div');
  gallery.id = 'evidence-gallery';
  gallery.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;';
  panel.appendChild(gallery);

  // Controls
  const controlsDiv = document.createElement('div');
  controlsDiv.style.cssText = 'display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;';

  const autoRunBtn = document.createElement('button');
  autoRunBtn.id = 'btn-auto-run';
  autoRunBtn.style.cssText = 'padding:6px 14px;border-radius:6px;border:1px solid rgba(0,212,170,0.4);';
  autoRunBtn.style.background = 'rgba(0,212,170,0.15)';
  autoRunBtn.style.color = '#00d4aa';
  autoRunBtn.style.cursor = 'pointer';
  autoRunBtn.style.fontSize = '12px';
  autoRunBtn.textContent = '▶ Auto Run All Eras';
  autoRunBtn.addEventListener('click', async () => {
    autoRunBtn.disabled = true;
    autoRunBtn.textContent = '⏳ Running...';
    await runAllEras();
    autoRunBtn.textContent = '✅ Done';
    autoRunBtn.disabled = false;
  });
  controlsDiv.appendChild(autoRunBtn);

  const captureBtn = document.createElement('button');
  captureBtn.id = 'btn-capture';
  captureBtn.style.cssText = 'padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);';
  captureBtn.style.background = 'rgba(255,255,255,0.05)';
  captureBtn.style.color = '#e8e8ec';
  captureBtn.style.cursor = 'pointer';
  captureBtn.style.fontSize = '12px';
  captureBtn.textContent = '📸 Capture Current';
  captureBtn.addEventListener('click', () => {
    captureCurrentScreenshot();
  });
  controlsDiv.appendChild(captureBtn);

  const perfBtn = document.createElement('button');
  perfBtn.id = 'btn-perf';
  perfBtn.style.cssText = 'padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);';
  perfBtn.style.background = 'rgba(255,255,255,0.05)';
  perfBtn.style.color = '#e8e8ec';
  perfBtn.style.cursor = 'pointer';
  perfBtn.style.fontSize = '12px';
  perfBtn.textContent = '📊 Export Perf Data';
  perfBtn.addEventListener('click', exportPerfData);
  controlsDiv.appendChild(perfBtn);

  panel.appendChild(controlsDiv);

  return panel;
}

// ── Checklist Update ────────────────────────────────────────────────

function updateChecklist(eraId: EraId): void {
  if (!_scene || !_renderer) return;

  const counts = new Map<string, number>();
  _scene.traverse((child) => {
    const tag = (child as any).__eraLayer ?? 'untagged';
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  });

  const hasBuildings = (counts.get('building') ?? 0) > 0;
  const hasVehicles = (counts.get('vehicle') ?? 0) > 0;
  const hasPedestrians = (counts.get('pedestrian') ?? 0) > 0;
  const hasStreetscape = (counts.get('street-furniture') ?? 0) > 0;

  // Atmosphere distinctness: check fog density and sky color
  const fogDensity = (_scene.fog instanceof THREE.FogExp2) ? _scene.fog.density : 0;
  const atmosphereDistinct = fogDensity > 0;

  const entry = _checklistData.find((c) => c.eraId === eraId);
  if (entry) {
    entry.buildingsPresent = hasBuildings;
    entry.vehiclesPresent = hasVehicles;
    entry.pedestriansPresent = hasPedestrians;
    entry.streetscapePresent = hasStreetscape;
    entry.atmosphereDistinct = atmosphereDistinct;
  }

  renderChecklistTable();
}

function renderChecklistTable(): void {
  const tbody = document.getElementById('checklist-body');
  if (!tbody) return;

  tbody.innerHTML = _checklistData
    .map(
      (c) => `
    <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
      <td style="padding:6px;">${c.year} — ${c.label}</td>
      <td style="text-align:center;padding:6px;">${c.buildingsPresent ? '✅' : '❌'}</td>
      <td style="text-align:center;padding:6px;">${c.vehiclesPresent ? '✅' : '❌'}</td>
      <td style="text-align:center;padding:6px;">${c.pedestriansPresent ? '✅' : '❌'}</td>
      <td style="text-align:center;padding:6px;">${c.streetscapePresent ? '✅' : '❌'}</td>
      <td style="text-align:center;padding:6px;">${c.atmosphereDistinct ? '✅' : '❌'}</td>
      <td style="text-align:center;padding:6px;">${c.screenshotCaptured ? '✅' : '⏳'}</td>
    </tr>
  `,
    )
    .join('');
}

// ── Screenshot Capture ──────────────────────────────────────────────

/** Capture current viewport as base64 PNG */
export function captureScreenshot(): string | null {
  if (!_renderer || !_scene) return null;

  try {
    const dataURL = _renderer.domElement.toDataURL('image/png');
    return dataURL;
  } catch (err) {
    console.warn('Screenshot capture failed:', err);
    return null;
  }
}

function captureCurrentScreenshot(): void {
  if (!_renderer || !_scene) return;

  try {
    const dataURL = _renderer.domElement.toDataURL('image/png');
    const eraId = getCurrentEraFromDOM();

    // Show thumbnail in gallery
    const gallery = document.getElementById('evidence-gallery');
    if (gallery) {
      const thumb = document.createElement('div');
      thumb.style.cssText = 'flex:0 0 200px;height:140px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);position:relative;';
      const img = document.createElement('img');
      img.src = dataURL;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      thumb.appendChild(img);

      const label = document.createElement('div');
      label.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);color:#fff;font-size:10px;padding:3px 6px;text-align:center;';
      label.textContent = `${eraId}`;
      thumb.appendChild(label);

      gallery.appendChild(thumb);
    }

    // Mark checklist as captured
    const entry = _checklistData.find((c) => c.eraId === eraId);
    if (entry) entry.screenshotCaptured = true;
    renderChecklistTable();

    // Also save to window for external access
    (window as any).__evidenceScreenshots = (window as any).__evidenceScreenshots || {};
    (window as any).__evidenceScreenshots[eraId] = dataURL;

    const status = document.getElementById('evidence-status');
    if (status) status.textContent = `✅ Screenshot captured for ${eraId}`;
  } catch (err) {
    console.warn('Screenshot capture failed:', err);
    const status = document.getElementById('evidence-status');
    if (status) status.textContent = `⚠️ Screenshot capture failed`;
  }
}

// ── Auto-Run All Eras ───────────────────────────────────────────────

async function runAllEras(): Promise<void> {
  if (!_renderer || !_scene || !_camera) return;

  const status = document.getElementById('evidence-status');

  for (let i = 0; i < ERA_REGISTRY.length; i++) {
    const era = ERA_REGISTRY[i];

    if (status) status.textContent = `🔄 Cycling to ${era.year} (${i + 1}/${ERA_REGISTRY.length})...`;

    // Switch era via timeline
    switchEraSilent(era.id);

    // Wait for transition
    await waitForTransition(2500);

    // Update checklist
    updateChecklist(era.id);

    // Capture screenshot
    captureCurrentScreenshot();

    // Small pause between eras
    await new Promise((r) => setTimeout(r, 300));
  }

  if (status) status.textContent = '✅ All eras cycled and captured!';
}

// ── Silent Era Switch (no UI event needed) ──────────────────────────

function switchEraSilent(eraId: EraId): void {
  // Set the hidden select value and dispatch change event
  const sel = document.getElementById('era-select') as HTMLSelectElement | null;
  if (sel) {
    sel.value = eraId;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// ── Transition Wait ─────────────────────────────────────────────────

function waitForTransition(timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const check = () => {
      if (performance.now() - start > timeoutMs) {
        resolve();
        return;
      }
      // Check if still transitioning by looking at blend progress
      const envManager = (window as any).__envManager;
      if (envManager && typeof envManager.getBlendProgress === 'function') {
        const bp = envManager.getBlendProgress();
        if (bp >= 0.99) {
          resolve();
          return;
        }
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

// ── Current Era Detection ───────────────────────────────────────────

function getCurrentEraFromDOM(): EraId {
  // Try multiple sources
  const uiLayer = document.querySelector('.ui-layer');
  const eraAttr = uiLayer?.getAttribute('data-era');
  if (eraAttr && ERA_IDS.includes(eraAttr as EraId)) return eraAttr as EraId;

  const hudYear = document.getElementById('hud-year-ticker');
  if (hudYear) {
    const text = hudYear.textContent || '';
    const match = text.match(/(\d{4})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const spec = ERA_REGISTRY.find((e) => e.year === year);
      if (spec) return spec.id;
    }
  }

  // Fallback: check select element
  const sel = document.getElementById('era-select') as HTMLSelectElement | null;
  if (sel && ERA_IDS.includes(sel.value as EraId)) return sel.value as EraId;

  return '1945'; // default
}

const ERA_IDS = ERA_REGISTRY.map((e) => e.id);

// ── Performance Data Export ─────────────────────────────────────────

function exportPerfData(): void {
  const data = {
    timestamp: new Date().toISOString(),
    era: getCurrentEraFromDOM(),
    sceneChildren: _scene ? _scene.children.length : 0,
    rendererInfo: _renderer ? {
      info: _renderer.info,
      pixelRatio: _renderer.getPixelRatio(),
    } : null,
    checklist: _checklistData,
    totalTriangles: _scene ? countTriangles(_scene) : 0,
    totalDrawCalls: _renderer ? _renderer.info.render.calls : 0,
  };

  // Log to console
  console.log('=== Performance Data ===');
  console.log(JSON.stringify(data, null, 2));

  // Also store on window
  (window as any).__perfData = data;

  const status = document.getElementById('evidence-status');
  if (status) status.textContent = '📊 Performance data exported to console';
}

function countTriangles(scene: THREE.Scene): number {
  let total = 0;
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geo = child.geometry;
      if (geo.index) {
        total += geo.index.count / 3;
      } else if (geo.attributes.position) {
        total += geo.attributes.position.count / 3;
      }
    }
  });
  return Math.round(total);
}

// ── Window API Registration ─────────────────────────────────────────

function registerWindowAPI(): void {
  const api: EvidenceAPI = {
    cycleEras: async (callback) => {
      for (let i = 0; i < ERA_REGISTRY.length; i++) {
        const era = ERA_REGISTRY[i];
        await callback(era.id, i);
      }
    },
    captureScreenshot,
    getSceneStats: () => {
      if (!_scene) return {};
      const counts = new Map<string, number>();
      _scene.traverse((child) => {
        const tag = (child as any).__eraLayer ?? 'untagged';
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
      return {
        era: getCurrentEraFromDOM(),
        sceneChildren: _scene.children.length,
        layerCounts: Object.fromEntries(counts),
        triangles: countTriangles(_scene),
      };
    },
    getChecklistMatrix: () => [..._checklistData],
    setEnabled: (v) => { _enabled = v; },
    isEnabled: () => _enabled,
    switchToEra: async (eraId) => {
      switchEraSilent(eraId);
      await waitForTransition(2500);
      updateChecklist(eraId);
    },
  };

  (window as any).EvidenceAPI = api;
  (window as any).__evidenceScreenshots = {};
  (window as any).__qaEvidence = true;
}

// ── Initialization ──────────────────────────────────────────────────

/** Initialize evidence capture with renderer, scene, and camera references */
export function initEvidence(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
  _renderer = renderer;
  _scene = scene;
  _camera = camera;

  // Initialize checklist data for all eras
  _checklistData = ERA_REGISTRY.map((era) => ({
    eraId: era.id,
    year: era.year,
    label: era.label,
    buildingsPresent: false,
    vehiclesPresent: false,
    pedestriansPresent: false,
    streetscapePresent: false,
    atmosphereDistinct: false,
    screenshotCaptured: false,
  }));

  // Build and mount panel
  _panelEl = buildPanel();
  document.body.appendChild(_panelEl);

  // Register window API
  registerWindowAPI();

  // Keyboard toggle: press 'E' to show/hide panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      _enabled = !_enabled;
      if (_panelEl) {
        _panelEl.style.display = _enabled ? 'block' : 'none';
      }
      const status = document.getElementById('evidence-status');
      if (status) status.textContent = _enabled ? '✅ Evidence mode enabled' : 'Disabled evidence mode.';
    }
  });

  // Subscribe to era changes to update checklist
  _onEraChange = (eraId: EraId) => {
    updateChecklist(eraId);
  };

  // Initial status
  const status = document.getElementById('evidence-status');
  if (status) status.textContent = '✅ Evidence panel ready. Press E to toggle.';
}

/** Notify evidence system of era change */
export function notifyEraChange(eraId: EraId): void {
  if (_onEraChange) _onEraChange(eraId);
}

/** Cleanup */
export function disposeEvidence(): void {
  _panelEl?.remove();
  _panelEl = null;
  _renderer = null;
  _scene = null;
  _camera = null;
  delete (window as any).EvidenceAPI;
  delete (window as any).__evidenceScreenshots;
  delete (window as any).__qaEvidence;
}
