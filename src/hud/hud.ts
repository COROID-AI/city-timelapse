/**
 * Neon DOM HUD overlay for the street racing game.
 *
 * Owns `src/hud/**` only. Consumes the race director's `RaceState` and the
 * player's `CarState` / `NitrousState` through read-only shared contracts and
 * renders a lightweight, pointer-transparent, responsive overlay:
 *
 *   - speed readout
 *   - nitrous meter bar with the boost-key hint
 *   - current lap (x/3)
 *   - current lap time + total race time
 *   - live standings list
 *   - 3-2-1-GO countdown during `RacePhase.Countdown`
 *   - finish panel (final classification, total time, restart hint)
 *
 * `update(raceState, playerState)` is called every frame by the integration
 * task. It refreshes the overlay with *minimal DOM diffing*: text and style
 * writes only happen when a value actually changed, gated through the pure
 * helpers in `hudState.ts`.
 *
 * Lifecycle (consumed by integration-polish):
 *   `createHud(root)` -> build the DOM overlay
 *   `hud.update(raceState, playerState)` -> refresh every frame
 *   `hud.dispose()` -> remove the overlay and drop all references
 *
 * The overlay is purely presentational and holds no game logic; it never
 * mutates `RaceState` / `CarState` / `NitrousState`.
 */

import type { CarState, NitrousState, RaceState } from '../shared/types';
import { BOOST_HINT } from '../input/keyboard';
import {
  countdownLabel,
  createDiffTracker,
  formatLap,
  formatSpeed,
  formatTime,
  tintPercent,
  type DiffTracker,
} from './hudState';

/** A DOM element whose text writes are diff-gated per frame. */
interface TextEl {
  readonly el: HTMLElement;
  /** Write `value` only when it differs from the last written value. */
  set(value: string): void;
}

/** Owned DOM references for the overlay. */
interface HudElements {
  readonly root: HTMLDivElement;
  readonly speed: TextEl;
  readonly nitrousFill: HTMLDivElement;
  readonly nitrousPct: TextEl;
  readonly lap: TextEl;
  readonly lapTime: TextEl;
  readonly totalTime: TextEl;
  readonly standings: HTMLUListElement;
  readonly countdown: HTMLDivElement;
  readonly finish: HTMLDivElement;
}

/** Cache of the standings snapshot so the list is rebuilt only on change. */
interface StandingsCache {
  signature: string;
}

/** The refreshable handle handed back by `createHud`. */
export interface Hud {
  /** Refresh the overlay from the latest frame snapshots (diff-gated). */
  update(raceState: RaceState, playerState: PlayerHudState): void;
  /** Remove the overlay from the DOM and drop every internal reference. */
  dispose(): void;
}

/** The player aggregates everything the HUD shows about the player car. */
export interface PlayerHudState {
  /** The player's own instantaneous car snapshot. */
  readonly car: CarState;
  /** The player's nitrous reserve / boost state. */
  readonly nitrous: NitrousState;
}

/**
 * Bind an element's text to a handle whose `set()` writes only when the value
 * actually changed — the core of the per-frame minimal DOM diffing.
 */
function bindText(el: HTMLElement, key: string, tracker: DiffTracker): TextEl {
  return {
    el,
    set(value: string): void {
      if (tracker.record(key, value)) el.textContent = value;
    },
  };
}

/** Current lap time: most recently completed lap's time in ms (0 if none). */
function currentLapMs(race: RaceState, carId: string): number {
  const times = race.lapTimes[carId];
  if (!times || times.length === 0) return 0;
  return times[times.length - 1] ?? 0;
}

/** Build the HUD DOM inside `root`. Returns the owned element handles. */
function buildDom(root: HTMLElement, tracker: DiffTracker): HudElements {
  const rootEl = document.createElement('div');
  rootEl.className = 'neon-hud';
  rootEl.style.pointerEvents = 'none';
  root.appendChild(rootEl);

  // Background veil to separate panels from the 3D scene.
  const background = document.createElement('div');
  background.className = 'neon-hud__backdrop';
  rootEl.appendChild(background);

  // Top-left group: lap + clocks.
  const lapEl = document.createElement('div');
  lapEl.className = 'neon-hud__lap';
  const lap = bindText(lapEl, 'lap', tracker);
  rootEl.appendChild(lapEl);

  const lapTimeEl = document.createElement('div');
  lapTimeEl.className = 'neon-hud__clock';
  const lapTime = bindText(lapTimeEl, 'lapTime', tracker);
  rootEl.appendChild(lapTimeEl);

  const totalEl = document.createElement('div');
  totalEl.className = 'neon-hud__clock neon-hud__clock--total';
  const totalTime = bindText(totalEl, 'totalTime', tracker);
  rootEl.appendChild(totalEl);

  // Centre-top speed readout.
  const speedEl = document.createElement('div');
  speedEl.className = 'neon-hud__speed';
  const speed = bindText(speedEl, 'speed', tracker);
  const speedUnit = document.createElement('span');
  speedUnit.className = 'neon-hud__speed-unit';
  speedUnit.textContent = 'km/h';
  speedEl.appendChild(speedUnit);
  rootEl.appendChild(speedEl);

  // Nitrous meter with boost-key hint.
  const nitrous = document.createElement('div');
  nitrous.className = 'neon-hud__nitrous';
  const nitrousLabel = document.createElement('span');
  nitrousLabel.className = 'neon-hud__nitrous-label';
  nitrousLabel.textContent = 'NITROUS';
  const bar = document.createElement('div');
  bar.className = 'neon-hud__bar';
  const nitrousFill = document.createElement('div');
  nitrousFill.className = 'neon-hud__bar-fill';
  bar.appendChild(nitrousFill);
  const nitrousPct = bindText(
    document.createElement('span'),
    'nitrousPct',
    tracker,
  );
  nitrousPct.el.className = 'neon-hud__nitrous-pct';
  const hint = document.createElement('span');
  hint.className = 'neon-hud__hint';
  hint.textContent = BOOST_HINT;
  nitrous.append(nitrousLabel, bar, nitrousPct.el, hint);
  rootEl.appendChild(nitrous);

  // Right-hand live standings list.
  const standings = document.createElement('ul');
  standings.className = 'neon-hud__standings';
  rootEl.appendChild(standings);

  // Countdown overlay.
  const countdown = document.createElement('div');
  countdown.className = 'neon-hud__countdown';
  rootEl.appendChild(countdown);

  // Finish panel.
  const finish = document.createElement('div');
  finish.className = 'neon-hud__finish';
  rootEl.appendChild(finish);

  return {
    root: rootEl,
    speed,
    nitrousFill,
    nitrousPct,
    lap,
    lapTime,
    totalTime,
    standings,
    countdown,
    finish,
  };
}

/**
 * Create the HUD overlay under `root`. The overlay is a fully owned subtree
 * appended to (never replacing) `root`, so multiple systems can coexist.
 */
export function createHud(root: HTMLElement): Hud {
  const tracker = createDiffTracker();
  const hud = buildDom(root, tracker);
  const standingsCache: StandingsCache = { signature: '' };

  const update = (race: RaceState, player: PlayerHudState): void => {
    // --- Speed, lap, clocks (all writes diff-gated by the trackers) --------
    hud.speed.set(formatSpeed(player.car.speed));
    hud.lap.set(formatLap(player.car.lap + 1, race.totalLaps || 3));
    hud.lapTime.set(formatTime(currentLapMs(race, player.car.id)));
    hud.totalTime.set(formatTime(race.timeMs));

    // --- Nitrous meter: fill width + boost glow ----------------------------
    const percent = tintPercent(player.nitrous.reserve);
    const width = `${percent}%`;
    if (tracker.record('nitrousWidth', width)) {
      hud.nitrousFill.style.width = width;
    }
    const boosting = player.nitrous.active;
    if (tracker.record('nitrousBoost', boosting)) {
      hud.nitrousFill.classList.toggle('neon-hud__bar-fill--boost', boosting);
    }
    hud.nitrousPct.set(`${percent}%`);

    // --- Live standings: rebuild only when the snapshot changes ------------
    const signature = race.standings
      .map(
        (s) =>
          `${s.position}|${s.carId}|${s.lap}|${Math.round(s.gap)}|` +
          `${Math.round(s.timeMs)}`,
      )
      .join('~');
    if (signature !== standingsCache.signature) {
      standingsCache.signature = signature;
      hud.standings.textContent = '';
      hud.standings.append(...race.standings.map(renderStandingsRow));
    }

    // --- Countdown (3-2-1-GO) ----------------------------------------------
    const counting = race.phase === 'countdown';
    if (tracker.record('countdownVisible', counting)) {
      hud.countdown.style.display = counting ? 'block' : 'none';
    }
    if (counting) {
      const label = countdownLabel(race.countdown);
      if (tracker.record('countdownLabel', label)) {
        hud.countdown.textContent = label;
      }
      hud.countdown.dataset.tick = String(Math.ceil(Math.max(0, race.countdown)));
    }

    // --- Finish panel -------------------------------------------------------
    const finished = race.phase === 'finished';
    if (tracker.record('finishVisible', finished)) {
      hud.finish.style.display = finished ? 'block' : 'none';
    }
    if (finished) renderFinish(hud.finish, race);
  };

  const dispose = (): void => {
    hud.root.remove();
  };

  return { update, dispose };
}

/** Render a single leaderboard entry. */
function renderStandingsRow(entry: {
  position: number;
  carId?: string;
  name: string;
  lap: number;
  gap: number;
  timeMs: number;
}): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'neon-hud__standings-row';

  const pos = document.createElement('span');
  pos.className = 'neon-hud__standings-pos';
  pos.textContent = String(entry.position);

  const name = document.createElement('span');
  name.className = 'neon-hud__standings-name';
  name.textContent = entry.name;

  const meta = document.createElement('span');
  meta.className = 'neon-hud__standings-meta';
  meta.textContent =
    entry.gap === 0 ? `LAP ${entry.lap}` : `+${formatTime(entry.gap)}`;

  li.append(pos, name, meta);
  return li;
}

/**
 * Render the finish panel: title, winner classification, total time, final
 * grid, and the restart hint.
 */
function renderFinish(finish: HTMLDivElement, race: RaceState): void {
  const leader = race.standings[0];
  if (!leader) return;

  finish.textContent = '';

  const title = document.createElement('div');
  title.className = 'neon-hud__finish-title';
  title.textContent = 'RESULTS';
  finish.appendChild(title);

  const place = document.createElement('div');
  place.className = 'neon-hud__finish-place';
  place.textContent = `P${leader.position} — ${leader.name}`;
  finish.appendChild(place);

  const time = document.createElement('div');
  time.className = 'neon-hud__finish-time';
  time.textContent = `Total ${formatTime(leader.timeMs)}`;
  finish.appendChild(time);

  const grid = document.createElement('ol');
  grid.className = 'neon-hud__finish-grid';
  for (const e of race.standings) {
    const li = document.createElement('li');
    li.textContent = `${e.position}. ${e.name} — ${formatTime(e.timeMs)}`;
    grid.appendChild(li);
  }
  finish.appendChild(grid);

  const restart = document.createElement('div');
  restart.className = 'neon-hud__finish-restart';
  restart.textContent = 'Press R to restart';
  finish.appendChild(restart);
}