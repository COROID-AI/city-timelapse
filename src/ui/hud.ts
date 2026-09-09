/**
 * HUD Component for City Time Period Timelapse.
 *
 * Renders the era descriptor line, navigation key hints, POI chips contract,
 * and audio mute control button.
 */

import type { TimelineChannel } from '../era/types';
import type { EraId } from '../era/years';
import type { TimelineState } from '../state/timelineStore';
import { eraDescriptors, eraSubtitles, formatEraChannelDescriptor } from './eraDescriptors';

export type PoiId = 'corner' | 'midblock' | 'rooftop';

export interface HudCallbacks {
  onToggleMute?: (muted: boolean) => void;
  onSelectPoi?: (poiId: PoiId) => void;
}

export interface HudInstance {
  readonly element: HTMLElement;
  readonly muteButton: HTMLButtonElement;
  readonly descriptorElement: HTMLElement;
  readonly poiButtons: ReadonlyMap<PoiId, HTMLButtonElement>;
  setDescriptor(text: string): void;
  setMuted(muted: boolean): void;
  setActivePoi(poiId: PoiId | null): void;
  update(channel: TimelineChannel, state: TimelineState): void;
  dispose(): void;
}

export function createHud(container: HTMLElement, callbacks: HudCallbacks = {}): HudInstance {
  const hud = document.createElement('div');
  hud.className = 'timelapse-hud';
  hud.setAttribute('role', 'region');
  hud.setAttribute('aria-label', 'City Information and Controls');

  // Left panel: Era descriptor line
  const descriptorContainer = document.createElement('div');
  descriptorContainer.className = 'hud-descriptor-card';

  const eraTag = document.createElement('span');
  eraTag.className = 'hud-era-badge';
  eraTag.textContent = '1945';

  const descriptorText = document.createElement('span');
  descriptorText.className = 'hud-descriptor-text';
  descriptorText.textContent = eraDescriptors['1945'];

  descriptorContainer.appendChild(eraTag);
  descriptorContainer.appendChild(descriptorText);

  // Center panel: POI chips & Navigation hints
  const centerPanel = document.createElement('div');
  centerPanel.className = 'hud-center-panel';

  const poiBar = document.createElement('div');
  poiBar.className = 'hud-poi-chips';
  poiBar.setAttribute('role', 'toolbar');
  poiBar.setAttribute('aria-label', 'Camera viewpoints');

  const poiDefinitions: readonly { id: PoiId; label: string }[] = [
    { id: 'corner', label: 'Corner' },
    { id: 'midblock', label: 'Midblock' },
    { id: 'rooftop', label: 'Rooftop' },
  ];

  const poiButtons = new Map<PoiId, HTMLButtonElement>();
  let currentPoi: PoiId | null = 'corner';

  for (const def of poiDefinitions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `poi-chip ${def.id === currentPoi ? 'is-active' : ''}`;
    btn.dataset.poi = def.id;
    btn.setAttribute('aria-label', `${def.label} view`);
    btn.setAttribute('aria-pressed', def.id === currentPoi ? 'true' : 'false');
    btn.textContent = def.label;

    btn.addEventListener('click', () => {
      setActivePoiInternal(def.id);
      callbacks.onSelectPoi?.(def.id);
    });

    poiBar.appendChild(btn);
    poiButtons.set(def.id, btn);
  }

  function setActivePoiInternal(poiId: PoiId | null): void {
    currentPoi = poiId;
    for (const [id, btn] of poiButtons.entries()) {
      const isActive = id === poiId;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  }

  const hintsBar = document.createElement('div');
  hintsBar.className = 'hud-nav-hints';
  hintsBar.innerHTML = `
    <span class="hud-hint-item"><kbd>1–5</kbd> Jump Era</span>
    <span class="hud-hint-item"><kbd>← / →</kbd> Step</span>
    <span class="hud-hint-item"><kbd>Drag</kbd> Scrub</span>
  `;

  centerPanel.appendChild(poiBar);
  centerPanel.appendChild(hintsBar);

  // Right panel: Audio / Mute control
  const controlsPanel = document.createElement('div');
  controlsPanel.className = 'hud-controls-panel';

  const muteBtn = document.createElement('button');
  muteBtn.type = 'button';
  muteBtn.className = 'hud-mute-button';
  muteBtn.setAttribute('aria-label', 'Toggle audio mute');
  muteBtn.setAttribute('aria-pressed', 'false');

  let isMuted = false;
  function updateMuteButtonUI(): void {
    muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    muteBtn.classList.toggle('is-muted', isMuted);
    muteBtn.setAttribute('aria-label', isMuted ? 'Unmute audio' : 'Mute audio');
    muteBtn.innerHTML = isMuted
      ? `<span class="mute-icon" aria-hidden="true">🔇</span><span class="mute-label">Muted</span>`
      : `<span class="mute-icon" aria-hidden="true">🔊</span><span class="mute-label">Audio ON</span>`;
  }
  updateMuteButtonUI();

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    updateMuteButtonUI();
    callbacks.onToggleMute?.(isMuted);
  });

  controlsPanel.appendChild(muteBtn);

  hud.appendChild(descriptorContainer);
  hud.appendChild(centerPanel);
  hud.appendChild(controlsPanel);

  container.appendChild(hud);

  return {
    element: hud,
    muteButton: muteBtn,
    descriptorElement: descriptorText,
    poiButtons,
    setDescriptor(text: string) {
      descriptorText.textContent = text;
    },
    setMuted(muted: boolean) {
      isMuted = muted;
      updateMuteButtonUI();
    },
    setActivePoi(poiId: PoiId | null) {
      setActivePoiInternal(poiId);
    },
    update(channel: TimelineChannel, state: TimelineState) {
      eraTag.textContent = state.currentEra;
      const subtitle = eraSubtitles[state.currentEra as EraId] ?? '';
      if (state.isTransitioning || state.isScrubbing) {
        descriptorText.textContent = formatEraChannelDescriptor(channel, state.currentEra as EraId);
      } else {
        descriptorText.textContent =
          eraDescriptors[state.currentEra as EraId] ?? `${state.currentEra} — ${subtitle}`;
      }
    },
    dispose() {
      if (hud.parentNode) {
        hud.parentNode.removeChild(hud);
      }
    },
  };
}
