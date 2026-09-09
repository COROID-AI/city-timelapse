/*
 * Neon Street Racer — DOM HUD overlay.
 *
 * Renders live race state as a neon-styled overlay inside a provided
 * container: digital speed, nitrous charge gauge (fills while drifting,
 * flashes during boost), lap counter, race timer, live standings panel,
 * a 3-2-1-GO start countdown, and a finish results banner.
 *
 * The overlay is DOM-only (no canvas, no THREE imports): all state is
 * consumed read-only from the shared contracts and every mutation targets
 * only the DOM node whose displayed value actually changed.
 */

import type { CarState, HUDHandle, RaceState, StandingEntry } from './contracts';
import './hud.css';

/** Colours for the racer identity chips, keyed by car id. */
const CHIP_COLORS: Record<string, string> = {
  player: '#ff2bd6',
  rival1: '#7a5cff',
  rival2: '#3dffb0',
  rival3: '#ffb62e',
  rival4: '#5ee8ff',
  rival5: '#ff5f8f',
};

const DEFAULT_CHIP_COLOR = '#7fd7ff';
const FALLBACK_LAP = 1;
const FALLBACK_TOTAL_LAPS = 3;

/**
 * Format seconds as `mm:ss.cs` (the same format the race director
 * exports for its lap timing).
 */
function formatTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds >= 0 ? totalSeconds : 0;
  const totalCentiseconds = Math.floor(safe * 100);
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  const pad = (value: number, width: number) => String(value).padStart(width, '0');
  return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(centiseconds, 2)}`;
}

/** Floor a speed value so the readout never shows spurious negative wheelspeed. */
function readSpeed(car: CarState | undefined): number {
  const speed = car?.speed ?? 0;
  return Number.isFinite(speed) && speed > 0 ? speed : 0;
}

/** Stable fingerprint of one standings row; used to avoid needless rebuilds. */
function keyOf(standing: StandingEntry): object {
  return {
    carId: standing.carId,
    lap: standing.lap,
    trackProgress: standing.trackProgress,
    bestLapSeconds: standing.bestLapSeconds,
    totalSeconds: standing.totalSeconds,
  };
}

/** Remove every child of an element (used to rebuild dynamic lists). */
function clearChildren(node: Element): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

/** Create a new element with class names and optional text content. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

/**
 * The full HUD surface: the frozen HUDHandle plus an optional per-call
 * car snapshot, so the overlay can be driven with
 * `update(raceState, playerState)` while remaining assignable to the
 * canonical `HUDHandle` (whose `update` takes only the race snapshot).
 */
type HUDRuntimeHandle = HUDHandle & {
  update: (race: RaceState, car?: CarState) => void;
};

/**
 * Mount the neon HUD overlay into `container`.
 *
 * The returned handle's `update(race, car)` refreshes only the DOM nodes
 * whose rendered value actually changed: speed, lap, timer, and the
 * nitrous gauge keep stable elements; the standings list is restamped only
 * when its contents change; the countdown and results banner react to race
 * phase transitions. `dispose()` removes all overlay DOM and releases every
 * listener the overlay owns.
 *
 * @param container  Element the overlay mounts into.
 * @param player     Optional stable reference to the player's CarState.
 *                   The HUD re-reads `speed`, `nitrousCharge`,
 *                   `boostActive`, and `lap` on every update call, so the
 *                   same mutable object (or a fresh CarState per call via
 *                   `update`) can be reused — the overlay never mutates it.
 */
export function createHUD(container: HTMLElement, player?: CarState): HUDRuntimeHandle {
  // Root overlay + shared neon panel skin.
  const root = el('div', 'neon-hud');
  root.id = 'neon-hud';
  root.setAttribute('data-hud-role', 'overlay');

  // --- Speed ----------------------------------------------------------------
  const speedPanel = el('section', 'neon-panel');
  speedPanel.id = 'neon-hud-speed';
  const speedTitle = el('span', 'neon-title', 'Speed');
  speedTitle.id = 'neon-hud-speed-title';
  const speedValue = el('span', 'neon-hud-speed-value', '000');
  speedValue.id = 'neon-hud-speed-value';
  const speedUnits = el('span', 'neon-hud-speed-units', 'KM/H');
  speedUnits.id = 'neon-hud-speed-units';
  speedPanel.append(speedTitle, speedValue, speedUnits);

  // --- Lap + timer ----------------------------------------------------------
  const lapPanel = el('section', 'neon-panel');
  lapPanel.id = 'neon-hud-lap';
  const lapTitle = el('span', 'neon-title', 'Lap');
  lapTitle.id = 'neon-hud-lap-title';
  const lapText = el('span', 'neon-hud-lap-text', `Lap ${FALLBACK_LAP}/${FALLBACK_TOTAL_LAPS}`);
  lapText.id = 'neon-hud-lap-text';
  const timer = el('span', 'neon-hud-timer', formatTime(0));
  timer.id = 'neon-hud-timer';
  lapPanel.append(lapTitle, lapText, timer);

  // --- Nitrous gauge --------------------------------------------------------
  const nitrousPanel = el('section', 'neon-panel');
  nitrousPanel.id = 'neon-hud-nitrous';
  const nitrousTitle = el('span', 'neon-title', 'Nitrous');
  nitrousTitle.id = 'neon-hud-nitrous-title';
  const nitrousTrack = el('div', 'neon-hud-nitrous-track');
  const nitrousFill = el('div', 'neon-hud-nitrous-fill');
  nitrousFill.id = 'neon-hud-nitrous-fill';
  nitrousTrack.appendChild(nitrousFill);
  nitrousPanel.append(nitrousTitle, nitrousTrack);

  // --- Live standings ---------------------------------------------------------
  const standingsPanel = el('section', 'neon-panel');
  standingsPanel.id = 'neon-hud-standings';
  const standingsTitle = el('span', 'neon-title', 'Standings');
  standingsTitle.id = 'neon-hud-standings-title';
  const standingsList = el('ol', 'neon-hud-standings-list');
  standingsList.id = 'neon-hud-standings-list';
  standingsPanel.append(standingsTitle, standingsList);

  // --- Center stage: countdown + results (hidden until relevant) ----------------
  const center = el('div', 'neon-hud-center');
  center.id = 'neon-hud-center';
  const countdown = el('div', 'neon-hud-countdown', '3');
  countdown.id = 'neon-hud-countdown';
  center.appendChild(countdown);

  const results = el('section', 'neon-panel');
  results.id = 'neon-hud-results';
  const resultsTitle = el('span', 'neon-results-title', 'Finish');
  resultsTitle.id = 'neon-hud-results-title';
  const resultsList = el('ol', 'neon-hud-results-list');
  resultsList.id = 'neon-hud-results-list';
  results.append(resultsTitle, resultsList);

  root.append(speedPanel, lapPanel, nitrousPanel, standingsPanel, center, results);
  container.appendChild(root);

  // --- Change tracking ---------------------------------------------------------
  const speedNode = root.querySelector('#neon-hud-speed-value')!;
  const lapNode = root.querySelector('#neon-hud-lap-text')!;
  const timerNode = root.querySelector('#neon-hud-timer')!;
  const nitrousFillNode = root.querySelector('#neon-hud-nitrous-fill') as HTMLElement;
  const standingsListNode = root.querySelector('#neon-hud-standings-list')!;
  const centerNode = root.querySelector('#neon-hud-center') as HTMLElement;
  const countdownNode = root.querySelector('#neon-hud-countdown')!;
  const resultsNode = root.querySelector('#neon-hud-results') as HTMLElement;

  let lastSpeed = '';
  let lastLap = '';
  let lastTimer = '';
  let lastCharge = '';
  let lastBoost = false;
  let lastStandingsKey = '';
  let lastResultsKey = '';

  /** Rebuild (only when needed) the live standings list. */
  const setStandings = (standings: readonly StandingEntry[]): void => {
    const key = JSON.stringify(standings.map(keyOf));
    if (key === lastStandingsKey) {
      return;
    }
    lastStandingsKey = key;
    clearChildren(standingsListNode);
    for (let i = 0; i < standings.length; i += 1) {
      const entry = standings[i];
      const row = el('li', 'neon-standings-row');
      const position = el('span', 'neon-standings-position', String(i + 1));
      const chip = el('span', 'neon-standings-chip');
      chip.style.backgroundColor = CHIP_COLORS[entry.carId] ?? DEFAULT_CHIP_COLOR;
      const idNode = el('span', 'neon-standings-id', entry.carId);
      const timeNode = el('span', 'neon-standings-time', formatTime(entry.totalSeconds));
      row.append(position, chip, idNode, timeNode);
      standingsListNode.appendChild(row);
    }
  };

  /** Rebuild (only when needed) the finish results banner rows. */
  const setResults = (standings: readonly StandingEntry[]): void => {
    const key = JSON.stringify(standings.map(keyOf));
    if (key === lastResultsKey) {
      return;
    }
    lastResultsKey = key;
    clearChildren(resultsList);
    for (let i = 0; i < standings.length; i += 1) {
      const entry = standings[i];
      const row = el('li', 'neon-results-row');
      const position = el('span', 'neon-results-position', String(i + 1));
      const chip = el('span', 'neon-results-chip');
      chip.style.backgroundColor = CHIP_COLORS[entry.carId] ?? DEFAULT_CHIP_COLOR;
      const idNode = el('span', 'neon-results-id', entry.carId);
      const lapNodeRow = el('span', 'neon-results-lap', `Lap ${entry.lap}`);
      const timeNode = el('span', 'neon-results-time', formatTime(entry.totalSeconds));
      row.append(position, chip, idNode, lapNodeRow, timeNode);
      resultsList.appendChild(row);
    }
  };

  /** Paint the start countdown ("3" → "2" → "1" → "GO"). */
  const paintCountdown = (seconds: number): void => {
    const rounded = Math.max(0, Math.round(seconds));
    const text = rounded > 0 ? String(rounded) : 'GO';
    if (countdownNode.textContent === text) {
      return;
    }
    countdownNode.textContent = text;
    countdownNode.classList.toggle('neon-go', rounded === 0);
  };

  let lastPhase: RaceState['phase'] | null = null;
  let lastCountdown = -1;

  /**
   * Refresh the overlay from the latest race snapshot.
   *
   * Only changed DOM nodes are touched: numeric readouts compare their
   * formatted string, the nitrous gauge compares its percentage + boost
   * class, the standings lists restamp only when their contents change, and
   * the countdown/results banner react to phase transitions.
   *
   * @param race  Latest RaceState snapshot.
   * @param car   Player CarState. Pass a mutable player reference once via
   *              `createHUD(container, player)` or per call here; the value
   *              is consumed read-only either way.
   */
  const update = (race: RaceState, car: CarState | undefined = player): void => {
    const totalLaps = race.totalLaps && race.totalLaps > 0 ? race.totalLaps : FALLBACK_TOTAL_LAPS;

    // Speed readout.
    const speedText = String(Math.floor(readSpeed(car))).padStart(3, '0');
    if (speedText !== lastSpeed) {
      lastSpeed = speedText;
      speedNode.textContent = speedText;
    }

    // Lap counter — "Lap X/3" from the player car's lap + race total.
    const lap = car?.lap ?? FALLBACK_LAP;
    const lapContent = `Lap ${lap}/${totalLaps}`;
    if (lapContent !== lastLap) {
      lastLap = lapContent;
      lapNode.textContent = lapContent;
    }

    // Race timer.
    const timerText = formatTime(race.elapsedSeconds);
    if (timerText !== lastTimer) {
      lastTimer = timerText;
      timerNode.textContent = timerText;
    }

    // Nitrous gauge fill + boost flash state.
    const charge = Math.max(0, Math.min(1, car?.nitrousCharge ?? 0));
    const chargeText = `${Math.round(charge * 100)}%`;
    if (chargeText !== lastCharge) {
      lastCharge = chargeText;
      nitrousFillNode.style.width = chargeText;
    }
    const boosting = Boolean(car?.boostActive);
    if (boosting !== lastBoost) {
      lastBoost = boosting;
      if (boosting) {
        nitrousFillNode.classList.add('neon-boost');
      } else {
        nitrousFillNode.classList.remove('neon-boost');
      }
    }

    // Live standings — restamp only on real content changes.
    setStandings(race.standings);

    // Center stage: countdown ↔ results ↔ hidden.
    const phase = race.phase ?? 'paused';
    if (phase !== lastPhase) {
      lastPhase = phase;
      centerNode.style.display = phase === 'countdown' ? 'block' : 'none';
      resultsNode.style.display = phase === 'finished' ? 'block' : 'none';
      if (phase !== 'countdown') {
        countdownNode.textContent = '';
        countdownNode.classList.remove('neon-go');
      }
      lastCountdown = -1;
    }

    if (phase === 'countdown' && race.countdown !== lastCountdown) {
      lastCountdown = race.countdown;
      paintCountdown(race.countdown);
    } else if (phase === 'finished') {
      setResults(race.standings);
    }
  };

  /**
   * Remove the overlay DOM and release every listener (and internal
   * reference) this HUD owns.
   */
  const dispose = (): void => {
    root.remove();
  };

  return { update, dispose };
}