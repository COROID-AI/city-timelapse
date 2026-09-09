/**
 * @jest-environment jsdom
 *
 * HUD overlay tests.
 *
 * Covers the HUDHandle lifecycle contract: createHUD mounts a neon DOM
 * overlay into a container, update() refreshes speed/nitrous/lap/timer/
 * standings from RaceState + CarState without full DOM rebuilds, the
 * nitrous gauge reflects charge and flashes while boosting, countdown and
 * results banner render on phase changes, and dispose() removes the overlay
 * DOM and releases listeners.
 */

import type { CarState, RaceState, StandingEntry } from '../src/game/contracts';
import { createHUD } from '../src/game/hud';

// The `three` package ships ESM that Jest's CJS runtime cannot require.
// The HUD tests only need a structural Vector3 for CarState fixtures, so
// mirror the foundation suite's hermetic shim.
jest.mock('three', () => {
  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
  }
  return { Vector3 };
});

import * as THREE from 'three';

/** Fresh, value-shaped player state for a single test. */
function makePlayer(overrides: Partial<CarState> = {}): CarState {
  return {
    position: new THREE.Vector3(),
    heading: 0,
    speed: 0,
    driftFactor: 0,
    nitrousCharge: 0,
    boostActive: false,
    lap: 1,
    trackProgress: 0,
    ...overrides,
  };
}

/** Fresh race snapshot with defaulted phase/standings. */
function makeRace(overrides: Partial<RaceState> = {}): RaceState {
  return {
    phase: 'countdown',
    countdown: 3,
    totalLaps: 3,
    elapsedSeconds: 0,
    lapTimers: {},
    standings: [
      {
        carId: 'player',
        lap: 1,
        trackProgress: 0.05,
        bestLapSeconds: null,
        totalSeconds: 0,
      },
      {
        carId: 'rival1',
        lap: 1,
        trackProgress: 0.02,
        bestLapSeconds: null,
        totalSeconds: 0,
      },
    ],
    ...overrides,
  };
}

/** Query helper scoped to the HUD root inside a container. */
function hudOf(container: HTMLElement, selector: string): HTMLElement {
  const found = container.querySelector(selector);
  if (!found) {
    throw new Error(`Expected HUD element matching "${selector}"`);
  }
  return found as HTMLElement;
}

describe('createHUD', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="hud-host"></div>';
    container = document.getElementById('hud-host') as HTMLElement;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts the neon overlay into the provided container', () => {
    const hud = createHUD(container);

    expect(container.querySelector('#neon-hud')).not.toBeNull();
    expect(container.querySelector('#neon-hud')!.getAttribute('data-hud-role')).toBe('overlay');
    expect(hud.update).toBeInstanceOf(Function);
    expect(hud.dispose).toBeInstanceOf(Function);

    hud.dispose();
  });

  it('renders speed from CarState with a padded digital readout', () => {
    createHUD(container).update(makeRace({ phase: 'racing' }), makePlayer({ speed: 42.4 }));

    expect(hudOf(container, '#neon-hud-speed-value').textContent).toBe('042');
  });

  it('renders "Lap X/3" from CarState lap and RaceState totalLaps', () => {
    createHUD(container).update(makeRace({ phase: 'racing' }), makePlayer({ lap: 2 }));

    expect(hudOf(container, '#neon-hud-lap-text').textContent).toBe('Lap 2/3');
  });

  it('renders the race timer in the mm:ss.cs format', () => {
    createHUD(container).update(makeRace({ phase: 'racing', elapsedSeconds: 65.25 }));

    expect(hudOf(container, '#neon-hud-timer').textContent).toBe('01:05.25');
  });

  it('renders the live standings panel with colored chips and positions', () => {
    const hud = createHUD(container);
    const standings: StandingEntry[] = [
      {
        carId: 'player',
        lap: 1,
        trackProgress: 0.5,
        bestLapSeconds: null,
        totalSeconds: 12.4,
      },
      {
        carId: 'rival1',
        lap: 1,
        trackProgress: 0.4,
        bestLapSeconds: null,
        totalSeconds: 15.1,
      },
    ];
    const race = makeRace({ phase: 'racing', standings });
    hud.update(race, makePlayer());

    const rows = Array.from(container.querySelectorAll('.neon-standings-row'));
    expect(rows).toHaveLength(2);

    const [first, second] = rows;
    expect(hudOf(first as HTMLElement, '.neon-standings-position').textContent).toBe('1');
    expect(hudOf(first as HTMLElement, '.neon-standings-id').textContent).toBe('player');
    expect(hudOf(second as HTMLElement, '.neon-standings-position').textContent).toBe('2');
    expect(hudOf(second as HTMLElement, '.neon-standings-id').textContent).toBe('rival1');

    // Chips pick up the neon palette keyed by car id.
    const chip = hudOf(first as HTMLElement, '.neon-standings-chip');
    expect(chip.style.backgroundColor).toBe('rgb(255, 43, 214)');

    hud.dispose();
  });

  it('refreshes changed values without rebuilding the DOM', () => {
    const hud = createHUD(container);
    const race = makeRace({ phase: 'racing' });
    const player = makePlayer();

    hud.update(race, player);

    const speedNode = hudOf(container, '#neon-hud-speed-value');
    const fillNode = hudOf(container, '#neon-hud-nitrous-fill');

    // Same underlying DOM nodes after repeated updates.
    const firstSpeedNode = speedNode;
    expect(container.querySelector('#neon-hud-speed-value')).toBe(firstSpeedNode);

    hud.update(race, player); // no change
    hud.update(
      makeRace({ phase: 'racing', elapsedSeconds: 7.5 }),
      makePlayer({ ...player, speed: 120, lap: 2, nitrousCharge: 0.8 }),
    );

    // Values updated in place on the same nodes.
    expect(container.querySelector('#neon-hud-speed-value')).toBe(firstSpeedNode);
    expect(hudOf(container, '#neon-hud-speed-value').textContent).toBe('120');
    expect(hudOf(container, '#neon-hud-lap-text').textContent).toBe('Lap 2/3');
    expect(hudOf(container, '#neon-hud-timer').textContent).toBe('00:07.50');
    expect(fillNode.style.width).toBe('80%');
    expect(container.querySelectorAll('.neon-standings-row')).toHaveLength(2);

    hud.dispose();
  });

  it('fills the nitrous gauge from nitrousCharge (drift charge) and flashes on boostActive', () => {
    const hud = createHUD(container);

    const race = makeRace({ phase: 'racing' });
    const diveState = makePlayer({ speed: 60, nitrousCharge: 0.35, driftFactor: 0.9 });
    hud.update(race, diveState);

    const fillNode = hudOf(container, '#neon-hud-nitrous-fill');
    expect(fillNode.style.width).toBe('35%');
    expect(fillNode.classList).not.toContain('neon-boost');

    // Boost kicks in — the fill flashes.
    hud.update(race, makePlayer({ ...diveState, boostActive: true }));
    expect(fillNode.style.width).toBe('35%');
    expect(fillNode.classList).toContain('neon-boost');

    // Boost ends — flashing stops but charge remains.
    hud.update(race, makePlayer({ ...diveState, boostActive: false }));
    expect(fillNode.style.width).toBe('35%');
    expect(fillNode.classList).not.toContain('neon-boost');

    hud.dispose();
  });

  it('clamps nitrous charge into [0, 1]', () => {
    const hud = createHUD(container);
    hud.update(makeRace(), makePlayer({ nitrousCharge: 2.5 }));
    expect(hudOf(container, '#neon-hud-nitrous-fill').style.width).toBe('100%');

    hud.update(makeRace(), makePlayer({ nitrousCharge: -1 }));
    expect(hudOf(container, '#neon-hud-nitrous-fill').style.width).toBe('0%');

    hud.dispose();
  });

  it('renders the countdown 3-2-1-GO during the countdown phase', () => {
    const hud = createHUD(container);
    const countdownNode = () => hudOf(container, '#neon-hud-countdown');

    hud.update(makeRace({ phase: 'countdown', countdown: 3 }), makePlayer());
    expect(countdownNode().textContent).toBe('3');
    expect(hudOf(container, '#neon-hud-center').style.display).toBe('block');
    expect(hudOf(container, '#neon-hud-results').style.display).toBe('none');

    hud.update(makeRace({ phase: 'countdown', countdown: 2 }), makePlayer());
    expect(countdownNode().textContent).toBe('2');

    hud.update(makeRace({ phase: 'countdown', countdown: 1 }), makePlayer());
    expect(countdownNode().textContent).toBe('1');

    hud.update(makeRace({ phase: 'countdown', countdown: 0 }), makePlayer());
    expect(countdownNode().textContent).toBe('GO');

    // Racing hides the countdown stage again.
    hud.update(makeRace({ phase: 'racing', countdown: 0 }), makePlayer());
    expect(hudOf(container, '#neon-hud-center').style.display).toBe('none');

    hud.dispose();
  });

  it('renders the finish results banner with final standings when finished', () => {
    const hud = createHUD(container);
    const standings: StandingEntry[] = [
      {
        carId: 'player',
        lap: 3,
        trackProgress: 0.9,
        bestLapSeconds: 18.2,
        totalSeconds: 62.1,
      },
      {
        carId: 'rival1',
        lap: 3,
        trackProgress: 0.7,
        bestLapSeconds: 19.5,
        totalSeconds: 67.4,
      },
    ];

    hud.update(makeRace({ phase: 'racing' }), makePlayer());

    const race = makeRace({
      phase: 'finished',
      countdown: 0,
      elapsedSeconds: 62.1,
      standings,
    });
    hud.update(race, makePlayer({ lap: 3 }));

    const resultsNode = hudOf(container, '#neon-hud-results');
    const centerNode = hudOf(container, '#neon-hud-center');
    expect(resultsNode.style.display).toBe('block');
    expect(centerNode.style.display).toBe('none');
    expect(hudOf(container, '#neon-hud-results-title').textContent).toBe('Finish');

    const rows = Array.from(container.querySelectorAll('.neon-results-row'));
    expect(rows).toHaveLength(2);
    expect(hudOf(rows[0] as HTMLElement, '.neon-results-position').textContent).toBe('1');
    expect(hudOf(rows[0] as HTMLElement, '.neon-results-id').textContent).toBe('player');
    expect(hudOf(rows[0] as HTMLElement, '.neon-results-lap').textContent).toBe('Lap 3');
    expect(hudOf(rows[0] as HTMLElement, '.neon-results-time').textContent).toBe('01:02.10');

    // Same snapshot twice does not rebuild the banner rows.
    hud.update(race, makePlayer({ lap: 3 }));
    expect(container.querySelectorAll('.neon-results-row')).toHaveLength(2);

    hud.dispose();
  });

  it('dispose removes all overlay DOM and leaves the container empty', () => {
    const hud = createHUD(container);
    hud.update(makeRace({ phase: 'racing' }), makePlayer());

    expect(container.querySelector('#neon-hud')).not.toBeNull();

    hud.dispose();

    expect(container.querySelector('#neon-hud')).toBeNull();
    expect(container.children).toHaveLength(0);

    // A second dispose stays safe.
    hud.dispose();

    expect(container.querySelector('#neon-hud')).toBeNull();
  });
});