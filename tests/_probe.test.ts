/**
 * TEMPORARY probe (removed before submission): empirically measure composed
 * game behavior for drift/boost/camera/fps to calibrate receipt thresholds.
 * @jest-environment jsdom
 */
import * as THREE from 'three';

import { startGame } from '../src/game/main';
import type { InputState } from '../src/game/contracts';

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

const GO: InputState = { up: true, left: false, right: false, down: false, nitrous: false };
const IDLE: InputState = { up: false, left: false, right: false, down: false, nitrous: false };

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

describe('PROBE', () => {
  test('measure drift/boost/camera over a fast-forwarded race', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = `
      <div id="game-root">
        <canvas id="game-canvas" width="800" height="600"></canvas>
        <div id="neon-hud"></div>
        <button id="restart-button" type="button">Restart</button>
      </div>
    `;
    const host = document.getElementById('game-root') as HTMLDivElement;
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const restartButton = document.getElementById('restart-button') as HTMLButtonElement;

    const game = startGame(canvas, host, makeMockGL(), restartButton);
    runSeconds(game, 3.5, IDLE);
    expect(game.diagnostics.phase).toBe('racing');

    // 1) Straight-line drive: does speed build? does drift stay 0?
    runSeconds(game, 4, GO);
    const afterStraight = game.diagnostics;
    console.log('PROBE straight:', JSON.stringify({
      phase: afterStraight.phase,
      playerSpeed: afterStraight.player.speed,
      drift: afterStraight.player.driftFactor,
      charge: afterStraight.player.nitrousCharge,
      lap: afterStraight.player.lap,
    }));

    // 2) Hold right for 5s: does drift register + nitrous charge?
    runSeconds(game, 5, { up: true, left: false, right: true, down: false, nitrous: false });
    const afterTurn = game.diagnostics;
    console.log('PROBE turn:', JSON.stringify({
      playerSpeed: afterTurn.player.speed,
      drift: afterTurn.player.driftFactor,
      charge: afterTurn.player.nitrousCharge,
      boost: afterTurn.player.boostActive,
      appliedFov: afterTurn.effects.appliedFov,
    }));

    // 3) Boost with charge: Shift + up for 2s
    runSeconds(game, 2, { up: true, left: false, right: false, down: false, nitrous: true });
    const afterBoost = game.diagnostics;
    console.log('PROBE boost:', JSON.stringify({
      speed: afterBoost.player.speed,
      charge: afterBoost.player.nitrousCharge,
      boost: afterBoost.player.boostActive,
      appliedFov: afterBoost.effects.appliedFov,
      flameVisible: afterBoost.effects.flameVisible,
      blurDamp: afterBoost.effects.blurDamp,
      lap: afterBoost.player.lap,
      trackProgress: afterBoost.player.trackProgress,
    }));
    console.log('PROBE camera:', JSON.stringify({
      distance: afterBoost.camera.distance,
      fov: afterBoost.camera.fov,
      roll: afterBoost.camera.roll,
    }));

    // 4) Camera follows player through more driving
    runSeconds(game, 10, GO);
    const afterMore = game.diagnostics;
    console.log('PROBE more:', JSON.stringify({
      speed: afterMore.player.speed,
      lap: afterMore.player.lap,
      trackProgress: afterMore.player.trackProgress,
      cameraDistance: afterMore.camera.distance,
      elapsed: afterMore.elapsedSeconds,
    }));

    // 5) Continue to finish: how long until 3 laps?
    runSeconds(game, 90, GO);
    const end = game.diagnostics;
    console.log('PROBE end:', JSON.stringify({
      phase: end.phase,
      lap: end.player.lap,
      elapsed: end.elapsedSeconds,
      standings: end.standings.map((s) => `${s.carId}:lap${s.lap}:${Math.round(s.totalSeconds)}s`),
    }));

    game.dispose();
    jest.restoreAllMocks();
  });
});