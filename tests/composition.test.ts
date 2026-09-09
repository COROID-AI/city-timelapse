/**
 * @jest-environment jsdom
 *
 * Composition integration test (src/game/main.ts).
 *
 * Exercises the FULLY wired game through `startGame` with a real jsdom DOM
 * (HUD mounts, input attaches to window, resize listeners fire) and a mocked
 * WebGL renderer that satisfies the composer surface the effects pipeline
 * requires — no GL context, like the Jest sandbox.
 *
 * The test drives the fixed-timestep loop deterministically through its
 * public `stepFrame` handle, simulates the full race flow:
 *
 *   countdown (3-2-1) → racing (3 laps, timer, standings) → finished
 *   → restart (no reload) → countdown again → dispose cleanly
 *
 * and asserts the observable race/effects state at every phase.
 */
import * as THREE from 'three';

import { startGame } from '../src/game/main';
import type { InputState } from '../src/game/contracts';

/** Hermetic renderer satisfying the composer surface (no WebGL context). */
function makeMockGL() {
  return {
    isWebGLRenderer: true,
    setPixelRatio: () => {},
    setSize: () => {},
    getSize: (target: THREE.Vector2) => target.set(1600, 900),
    getPixelRatio: () => 1,
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    setEffects: () => {},
    render: () => {},
    dispose: () => {},
  };
}

/** Fixed-timestep input: throttle held while the pursuit helper steers. */
const GO: InputState = { up: true, left: false, right: false, down: false, nitrous: false };
const IDLE: InputState = { up: false, left: false, right: false, down: false, nitrous: false };

/** Run `seconds` of simulation through the loop's deterministic stepFrame. */
function runSeconds(game: ReturnType<typeof startGame>, seconds: number, input: InputState): void {
  Object.assign(game.input, input);
  const steps = Math.max(1, Math.round(seconds * 60));
  let now = 0;
  for (let i = 0; i < steps; i++) {
    now += 1000 / 60;
    game.loop.stepFrame(now);
  }
  Object.assign(game.input, IDLE);
}

describe('startGame composition (wired street racer)', () => {
  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let restartButton: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="game-root">
        <canvas id="game-canvas" width="800" height="600"></canvas>
        <div id="neon-hud"></div>
        <button id="restart-button" type="button">Restart</button>
      </div>
    `;
    host = document.getElementById('game-root') as HTMLDivElement;
    canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    restartButton = document.getElementById('restart-button') as HTMLButtonElement;
    // jsdom has no WebGL context; the renderer is injected via mockGL.
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('instantiates the fully wired game and exposes diagnostics + clean dispose', () => {
    const game = startGame(canvas, host, makeMockGL(), restartButton);

    expect(game).toBeDefined();
    expect(game.dispose).toBeInstanceOf(Function);
    expect(game.restartRace).toBeInstanceOf(Function);

    const diag = game.diagnostics;
    // All seven systems + loop + input are wired into the comPOSITION.
    expect(diag.counts.rivals).toBe(3);
    expect(diag.counts.signs).toBeGreaterThanOrEqual(8);
    expect(diag.counts.lamps).toBeGreaterThan(0);
    expect(diag.counts.buildings).toBeGreaterThan(0);
    expect(diag.counts.lights).toBeGreaterThan(0);
    expect(diag.phase).toBe('countdown');
    expect(diag.countdown).toBeGreaterThan(2.9);
    expect(diag.lap).toBe(1);
    expect(diag.standings.length).toBe(4); // player + 3 rivals

    // The shared live input snapshot backs the loop.
    expect(game.input).toBeDefined();
    expect(game.input.up).toBe(false);

    // HUD mounted a neon overlay into the root.
    expect(host.querySelector('#neon-hud')).not.toBeNull();
    expect(host.querySelector('#neon-hud-speed-value')).not.toBeNull();

    expect(() => game.dispose()).not.toThrow();
  });

  it('runs the full race flow: countdown → racing → finished with 3 laps and results', () => {
    const game = startGame(canvas, host, makeMockGL(), restartButton);

    // Countdown: cars idle on the grid, phase stays countdown until ~3s.
    runSeconds(game, 1.0, IDLE);
    expect(game.diagnostics.phase).toBe('countdown');

    // Racing begins after the 3s countdown.
    runSeconds(game, 3.0, IDLE);
    expect(game.diagnostics.phase).toBe('racing');
    expect(game.diagnostics.countdown).toBe(0);

    // Run a full three-lap race (composition's pursuit keeps the car on the
    // line; the race director tracks laps/timer/standings live).
    runSeconds(game, 70, GO);
    const finished = game.diagnostics;

    expect(finished.phase).toBe('finished');
    expect(finished.lap).toBe(4); // completed laps 1-3, now on (finished) lap 4
    expect(finished.standings.length).toBe(4);
    expect(finished.standings[0].carId).toBe('player');
    expect(finished.standings[0].lap).toBe(3);
    expect(finished.standings[0].bestLapSeconds).toBeGreaterThan(0);
    expect(finished.standings[0].totalSeconds).toBeGreaterThan(10);
    expect(finished.lapTimers.player).toBeGreaterThan(0);

    // HUD results banner is visible in finish state.
    const results = host.querySelector('#neon-hud-results') as HTMLElement;
    expect(results.style.display).toBe('block');

    expect(() => game.dispose()).not.toThrow();
  });

  it('restartRace resets cars, race director, and timer without reload', () => {
    const game = startGame(canvas, host, makeMockGL(), restartButton);

    runSeconds(game, 3.5, IDLE);
    runSeconds(game, 70, GO);
    expect(game.diagnostics.phase).toBe('finished');

    game.restartRace();

    const restarted = game.diagnostics;
    expect(restarted.phase).toBe('countdown');
    expect(restarted.countdown).toBeGreaterThan(2.9);
    expect(restarted.elapsedSeconds).toBe(0);
    expect(restarted.lap).toBe(1);
    // Standings reset to the fresh pre-race seeding.
    expect(restarted.standings.length).toBe(4);
    expect(restarted.standings.every((s) => s.bestLapSeconds === null)).toBe(true);

    // The game is still fully playable after restart.
    runSeconds(game, 3.5, IDLE);
    expect(game.diagnostics.phase).toBe('racing');
    runSeconds(game, 6, GO);
    expect(game.diagnostics.lap).toBeGreaterThanOrEqual(1);

    expect(() => game.dispose()).not.toThrow();
  });

  it('dispose tears down every system and later steps are inert', () => {
    const game = startGame(canvas, host, makeMockGL(), restartButton);

    runSeconds(game, 3.5, IDLE);
    runSeconds(game, 2, GO);

    game.dispose();

    // Idempotent + all subsystems inert.
    expect(() => game.dispose()).not.toThrow();
    expect(() => {
      game.loop.stepFrame(Date.now());
      game.restartRace();
    }).not.toThrow();
  });
});