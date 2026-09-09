import * as THREE from 'three';

import type { AIState, CarState, InputState, RaceHandle } from '../src/game/contracts';
import {
  DEFAULT_COUNTDOWN_SECONDS,
  DEFAULT_TOTAL_LAPS,
  NEON_RACER_COLORS,
  createRaceDirector,
  formatLapTime,
  formatMmSsCs,
  formatRaceTime,
  formatTime,
} from '../src/game/race';

// The `three` package mock for Jest in Node CJS
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
  class Object3D {}
  return { Vector3, Object3D };
});

describe('formatRaceTime helper', () => {
  it('formats zero seconds as 00:00.00', () => {
    expect(formatRaceTime(0)).toBe('00:00.00');
    expect(formatTime(0)).toBe('00:00.00');
    expect(formatLapTime(0)).toBe('00:00.00');
    expect(formatMmSsCs(0)).toBe('00:00.00');
  });

  it('handles negative or invalid numbers gracefully', () => {
    expect(formatRaceTime(-5)).toBe('00:00.00');
    expect(formatRaceTime(NaN)).toBe('00:00.00');
    expect(formatRaceTime(Infinity)).toBe('00:00.00');
    expect(formatRaceTime(-Infinity)).toBe('00:00.00');
  });

  it('formats sub-second centiseconds accurately', () => {
    expect(formatRaceTime(0.05)).toBe('00:00.05');
    expect(formatRaceTime(0.99)).toBe('00:00.99');
    expect(formatRaceTime(0.5)).toBe('00:00.50');
  });

  it('formats seconds and centiseconds accurately', () => {
    expect(formatRaceTime(5.25)).toBe('00:05.25');
    expect(formatRaceTime(59.99)).toBe('00:59.99');
  });

  it('formats minutes, seconds and centiseconds accurately', () => {
    expect(formatRaceTime(60.0)).toBe('01:00.00');
    expect(formatRaceTime(65.4)).toBe('01:05.40');
    expect(formatRaceTime(125.07)).toBe('02:05.07');
    expect(formatRaceTime(600.0)).toBe('10:00.00');
    expect(formatRaceTime(3661.23)).toBe('61:01.23');
  });
});

describe('createRaceDirector initialization and contracts', () => {
  it('conforms to the RaceHandle interface contract', () => {
    const director = createRaceDirector();
    const handle: RaceHandle = director;

    expect(handle.state).toBeDefined();
    expect(typeof handle.update).toBe('function');
    expect(typeof handle.onCarCrossStartLine).toBe('function');

    expect(handle.state.phase).toBe('countdown');
    expect(handle.state.countdown).toBe(DEFAULT_COUNTDOWN_SECONDS);
    expect(handle.state.totalLaps).toBe(DEFAULT_TOTAL_LAPS);
    expect(handle.state.elapsedSeconds).toBe(0);
    expect(handle.state.lapTimers).toBeDefined();
    expect(Array.isArray(handle.state.standings)).toBe(true);

    director.dispose();
  });

  it('initializes default player standings with position, name, and neon color', () => {
    const director = createRaceDirector();
    const { standings } = director.state;

    expect(standings.length).toBe(1);
    expect(standings[0].carId).toBe('player');
    expect(standings[0].lap).toBe(1);
    expect(standings[0].trackProgress).toBe(0);
    expect(standings[0].position).toBe(1);
    expect(standings[0].name).toBe('Player');
    expect(standings[0].color).toBe(NEON_RACER_COLORS[0]);
    expect(standings[0].bestLapSeconds).toBeNull();
    expect(standings[0].totalSeconds).toBe(0);

    director.dispose();
  });

  it('accepts custom racers list with AI opponents and custom total laps', () => {
    const director = createRaceDirector({
      totalLaps: 5,
      countdownSeconds: 2,
      racers: [
        { id: 'player', name: 'Ace', color: '#00ffff', isPlayer: true },
        { id: 'rival-1', name: 'Phantom', color: '#ff007f' },
        { id: 'rival-2', name: 'Viper', color: '#39ff14' },
      ],
    });

    expect(director.state.totalLaps).toBe(5);
    expect(director.state.countdown).toBe(2);
    expect(director.state.standings.length).toBe(3);

    expect(director.state.standings[0].carId).toBe('player');
    expect(director.state.standings[0].name).toBe('Ace');
    expect(director.state.standings[1].carId).toBe('rival-1');
    expect(director.state.standings[1].name).toBe('Phantom');
    expect(director.state.standings[2].carId).toBe('rival-2');
    expect(director.state.standings[2].name).toBe('Viper');

    director.dispose();
  });

  it('supports passing TrackData object with checkpoints directly', () => {
    const track = {
      startLine: { position: new THREE.Vector3(0, 0, 0), heading: 0 },
      waypoints: [new THREE.Vector3(0, 0, 0), new THREE.Vector3(100, 0, 0)],
      checkpoints: [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(50, 0, 0),
        new THREE.Vector3(100, 0, 0),
        new THREE.Vector3(50, 0, -50),
      ],
      closed: true,
      width: 15,
    };

    const director = createRaceDirector(track, { countdownSeconds: 1 });
    expect(director.state.phase).toBe('countdown');
    expect(director.state.countdown).toBe(1);

    director.dispose();
  });

  it('supports autoStart option to immediately enter racing phase', () => {
    const director = createRaceDirector({ autoStart: true });
    expect(director.state.phase).toBe('racing');
    expect(director.state.countdown).toBe(0);
    director.dispose();
  });
});

describe('Race phase transitions (countdown -> racing -> finished)', () => {
  it('counts down correctly and transitions to racing', () => {
    const onPhaseChange = jest.fn();
    const director = createRaceDirector({
      countdownSeconds: 3,
      onPhaseChange,
    });

    expect(director.state.phase).toBe('countdown');
    expect(director.state.countdown).toBe(3);

    // Tick 1s
    director.update(1.0);
    expect(director.state.phase).toBe('countdown');
    expect(director.state.countdown).toBe(2.0);
    expect(director.state.elapsedSeconds).toBe(0);

    // Tick 1.5s
    director.update(1.5);
    expect(director.state.phase).toBe('countdown');
    expect(director.state.countdown).toBe(0.5);
    expect(director.state.elapsedSeconds).toBe(0);

    // Tick 0.5s -> transition to racing
    director.update(0.5);
    expect(director.state.phase).toBe('racing');
    expect(director.state.countdown).toBe(0);
    expect(director.state.elapsedSeconds).toBe(0);
    expect(onPhaseChange).toHaveBeenCalledWith('racing');

    // Racing ticks advance elapsedSeconds
    director.update(1.0);
    expect(director.state.elapsedSeconds).toBe(1.0);

    director.dispose();
  });

  it('can start race immediately via startRace()', () => {
    const onPhaseChange = jest.fn();
    const director = createRaceDirector({ countdownSeconds: 5, onPhaseChange });
    expect(director.state.phase).toBe('countdown');

    director.startRace();
    expect(director.state.phase).toBe('racing');
    expect(director.state.countdown).toBe(0);
    expect(onPhaseChange).toHaveBeenCalledWith('racing');

    director.dispose();
  });

  it('can finish race immediately via finishRace()', () => {
    const onPhaseChange = jest.fn();
    const onRaceFinished = jest.fn();
    const director = createRaceDirector({
      autoStart: true,
      onPhaseChange,
      onRaceFinished,
    });

    director.update(10.0);
    director.finishRace();

    expect(director.state.phase).toBe('finished');
    expect(director.state.elapsedSeconds).toBe(10.0);
    expect(onPhaseChange).toHaveBeenCalledWith('finished');
    expect(onRaceFinished).toHaveBeenCalled();
    expect(director.getFinishTime('player')).toBe(10.0);

    director.dispose();
  });

  it('ignores negative deltaSeconds or updates after dispose', () => {
    const director = createRaceDirector({ autoStart: true });
    director.update(-1);
    expect(director.state.elapsedSeconds).toBe(0);

    director.update(5);
    expect(director.state.elapsedSeconds).toBe(5);

    director.dispose();
    director.update(5);
    expect(director.state.elapsedSeconds).toBe(5);
  });
});

describe('Lap counting and three-lap completion', () => {
  it('increments lap on crossing start line / checkpoint cycle during racing', () => {
    const onLapComplete = jest.fn();
    const director = createRaceDirector({
      autoStart: true,
      totalLaps: 3,
      onLapComplete,
    });

    expect(director.state.phase).toBe('racing');
    expect(director.state.standings[0].lap).toBe(1);

    // Lap 1: simulate driving around track through progress updates
    director.update(5.0);
    director.updateRacerProgress('player', 0.25);
    director.update(5.0);
    director.updateRacerProgress('player', 0.5);
    director.update(5.0);
    director.updateRacerProgress('player', 0.75);
    director.update(5.0);
    // Wrap around 0.95 -> 0.05
    director.updateRacerProgress('player', 0.05);

    // Completed lap 1
    expect(director.state.standings[0].lap).toBe(2);
    expect(onLapComplete).toHaveBeenCalledWith('player', 1, 20.0);
    expect(director.getLapTimes('player')).toEqual([20.0]);
    expect(director.getBestLapTime('player')).toBe(20.0);

    // Lap 2: simulate using onCarCrossStartLine
    director.update(15.0);
    director.onCarCrossStartLine('player');

    // Completed lap 2
    expect(director.state.standings[0].lap).toBe(3);
    expect(onLapComplete).toHaveBeenCalledWith('player', 2, 15.0);
    expect(director.getLapTimes('player')).toEqual([20.0, 15.0]);
    expect(director.getBestLapTime('player')).toBe(15.0);

    // Lap 3: final lap completion
    director.update(12.0);
    director.onCarCrossStartLine('player');

    // Finished race
    expect(director.state.phase).toBe('finished');
    expect(director.state.standings[0].lap).toBe(3);
    expect(director.getFinishTime('player')).toBe(47.0); // 20 + 15 + 12
    expect(director.getLapTimes('player')).toEqual([20.0, 15.0, 12.0]);
    expect(director.getBestLapTime('player')).toBe(12.0);

    director.dispose();
  });

  it('increments lap exactly once per checkpoint cycle (prevents double increments on progress jitter)', () => {
    const onLapComplete = jest.fn();
    const director = createRaceDirector({
      autoStart: true,
      totalLaps: 3,
      onLapComplete,
    });

    // Racer is oscillating around start/finish without clearing checkpoints (0.01 -> 0.99 -> 0.02)
    director.update(1.0);
    director.updateRacerProgress('player', 0.01);
    director.update(1.0);
    director.updateRacerProgress('player', 0.99); // backwards jitter
    director.update(1.0);
    director.updateRacerProgress('player', 0.02); // forward jitter across start line without visiting sectors

    // Lap should still be 1 because not enough checkpoint sectors were visited
    expect(director.state.standings[0].lap).toBe(1);
    expect(onLapComplete).not.toHaveBeenCalled();

    // Now legitimately visit sectors: 0.25, 0.5, 0.75, then cross 0.02
    director.updateRacerProgress('player', 0.25);
    director.updateRacerProgress('player', 0.5);
    director.updateRacerProgress('player', 0.75);
    director.updateRacerProgress('player', 0.02);

    // Now lap 1 is complete -> lap 2
    expect(director.state.standings[0].lap).toBe(2);
    expect(onLapComplete).toHaveBeenCalledTimes(1);

    director.dispose();
  });

  it('handles explicit lap property on CarState in update snapshots', () => {
    const director = createRaceDirector({
      autoStart: true,
      totalLaps: 3,
    });

    const dummyCar: CarState = {
      position: new THREE.Vector3(),
      heading: 0,
      speed: 30,
      driftFactor: 0,
      nitrousCharge: 1,
      boostActive: false,
      lap: 2,
      trackProgress: 0.4,
    };

    director.update(1.0, undefined, { player: dummyCar });
    expect(director.state.standings[0].lap).toBe(2);
    expect(director.state.standings[0].trackProgress).toBe(0.4);

    // Complete race by jumping to lap 3 and finishing
    dummyCar.lap = 3;
    dummyCar.trackProgress = 0.9;
    director.update(1.0, undefined, { player: dummyCar });
    expect(director.state.standings[0].lap).toBe(3);

    director.onCarCrossStartLine('player');
    expect(director.state.phase).toBe('finished');

    director.dispose();
  });
});

describe('Monotonic timers and per-lap timing', () => {
  it('advances elapsed race timer and lap timers monotonically', () => {
    const director = createRaceDirector({
      countdownSeconds: 3,
      totalLaps: 3,
      racers: ['player', 'rival-1'],
    });

    // In countdown, elapsed is 0, lap timers are 0
    expect(director.state.elapsedSeconds).toBe(0);
    expect(director.state.lapTimers['player']).toBe(0);
    expect(director.state.lapTimers['rival-1']).toBe(0);

    director.update(3.0); // countdown completes -> racing starts
    expect(director.state.phase).toBe('racing');

    let prevElapsed = director.state.elapsedSeconds;
    let prevPlayerTimer = director.state.lapTimers['player'];

    for (let i = 0; i < 10; i++) {
      director.update(0.1);
      const currentElapsed = director.state.elapsedSeconds;
      const currentPlayerTimer = director.state.lapTimers['player'];

      expect(currentElapsed).toBeGreaterThan(prevElapsed);
      expect(currentPlayerTimer).toBeGreaterThan(prevPlayerTimer);

      prevElapsed = currentElapsed;
      prevPlayerTimer = currentPlayerTimer;
    }

    // Player finishes lap 1 at t = 1.0s
    director.onCarCrossStartLine('player');
    expect(director.state.standings.find((s) => s.carId === 'player')?.lap).toBe(2);
    // Player lap timer resets to 0 (or delta since lap start) while rival lap timer continues
    expect(director.state.lapTimers['player']).toBe(0);
    expect(director.state.lapTimers['rival-1']).toBeCloseTo(1.0, 5);

    director.update(0.5);
    expect(director.state.lapTimers['player']).toBeCloseTo(0.5, 5);
    expect(director.state.lapTimers['rival-1']).toBeCloseTo(1.5, 5);
    expect(director.state.elapsedSeconds).toBeCloseTo(1.5, 5);

    director.dispose();
  });
});

describe('Live standings re-ranking by (lap, trackProgress)', () => {
  it('ranks racers by lap number first, then trackProgress', () => {
    const director = createRaceDirector({
      autoStart: true,
      racers: [
        { id: 'player', name: 'Player' },
        { id: 'rival-1', name: 'Rival 1' },
        { id: 'rival-2', name: 'Rival 2' },
        { id: 'rival-3', name: 'Rival 3' },
      ],
    });

    // Racer 3 is on Lap 2, Progress 0.10
    // Racer 1 is on Lap 1, Progress 0.85
    // Player is on Lap 1, Progress 0.50
    // Racer 2 is on Lap 1, Progress 0.20

    director.updateRacerProgress('rival-3', 0.1, { lap: 2 });
    director.updateRacerProgress('rival-1', 0.85);
    director.updateRacerProgress('player', 0.5);
    director.updateRacerProgress('rival-2', 0.2);

    const standings = director.state.standings;
    expect(standings.map((s) => s.carId)).toEqual(['rival-3', 'rival-1', 'player', 'rival-2']);
    expect(standings.map((s) => s.position)).toEqual([1, 2, 3, 4]);

    // Player overtakes Rival 1 (progress 0.90 vs 0.85 on lap 1)
    director.updateRacerProgress('player', 0.9);
    const updatedStandings = director.state.standings;
    expect(updatedStandings.map((s) => s.carId)).toEqual(['rival-3', 'player', 'rival-1', 'rival-2']);
    expect(updatedStandings.map((s) => s.position)).toEqual([1, 2, 3, 4]);

    director.dispose();
  });

  it('keeps finished racers at the top of standings ordered by finish time', () => {
    const director = createRaceDirector({
      autoStart: true,
      totalLaps: 3,
      racers: ['player', 'rival-1', 'rival-2'],
    });

    // Time 10s: rival-1 finishes first
    director.update(10.0);
    director.updateRacerProgress('rival-1', 0.5, { lap: 3 });
    director.onCarCrossStartLine('rival-1'); // rival-1 completes lap 3 -> finished at 10s

    expect(director.getFinishTime('rival-1')).toBe(10.0);

    // Time 15s: player finishes second
    director.update(5.0);
    director.updateRacerProgress('player', 0.5, { lap: 3 });
    director.onCarCrossStartLine('player'); // player completes lap 3 -> finished at 15s

    expect(director.getFinishTime('player')).toBe(15.0);

    // rival-2 is still racing on lap 3
    director.updateRacerProgress('rival-2', 0.8, { lap: 3 });

    const standings = director.state.standings;
    expect(standings[0].carId).toBe('rival-1');
    expect(standings[0].position).toBe(1);
    expect(standings[0].finishTime).toBe(10.0);

    expect(standings[1].carId).toBe('player');
    expect(standings[1].position).toBe(2);
    expect(standings[1].finishTime).toBe(15.0);

    expect(standings[2].carId).toBe('rival-2');
    expect(standings[2].position).toBe(3);
    expect(standings[2].finishTime).toBeNull();

    director.dispose();
  });

  it('populates extended standing entries with positions, names, colors and flags', () => {
    const director = createRaceDirector({
      autoStart: true,
      racers: [
        { id: 'player', name: 'Cyber Hero', color: '#00ffff', isPlayer: true },
        { id: 'rival-1', name: 'Neon Shadow', color: '#ff007f' },
      ],
    });

    const standings = director.state.standings;
    expect(standings[0]).toMatchObject({
      carId: 'player',
      name: 'Cyber Hero',
      color: '#00ffff',
      isPlayer: true,
      position: 1,
    });
    expect(standings[1]).toMatchObject({
      carId: 'rival-1',
      name: 'Neon Shadow',
      color: '#ff007f',
      isPlayer: false,
      position: 2,
    });

    director.dispose();
  });
});

describe('Update with CarState and AIState progress snapshot formats', () => {
  it('accepts array of RacerProgressSnapshot objects in update()', () => {
    const director = createRaceDirector({
      autoStart: true,
      racers: ['player', 'rival-1'],
    });

    const dummyCarPlayer: CarState = {
      position: new THREE.Vector3(10, 0, 10),
      heading: 0,
      speed: 40,
      driftFactor: 0,
      nitrousCharge: 1,
      boostActive: false,
      lap: 1,
      trackProgress: 0.6,
    };

    const dummyCarRival: CarState = {
      position: new THREE.Vector3(5, 0, 5),
      heading: 0,
      speed: 35,
      driftFactor: 0,
      nitrousCharge: 0.5,
      boostActive: false,
      lap: 1,
      trackProgress: 0.8,
    };

    const dummyAI: AIState = {
      aggression: 0.8,
      targetWaypoint: 5,
      steeringError: 0.01,
    };

    const dummyInput: InputState = {
      up: true,
      down: false,
      left: false,
      right: false,
      nitrous: false,
    };

    director.update(0.1, dummyInput, [
      { carId: 'player', state: dummyCarPlayer },
      { carId: 'rival-1', state: dummyCarRival, aiState: dummyAI },
    ]);

    expect(director.state.standings[0].carId).toBe('rival-1');
    expect(director.state.standings[0].trackProgress).toBe(0.8);
    expect(director.state.standings[1].carId).toBe('player');
    expect(director.state.standings[1].trackProgress).toBe(0.6);

    director.dispose();
  });

  it('accepts record map of CarState objects in update()', () => {
    const director = createRaceDirector({
      autoStart: true,
      racers: ['player', 'rival-1'],
    });

    const carMap: Record<string, CarState> = {
      player: {
        position: new THREE.Vector3(),
        heading: 0,
        speed: 50,
        driftFactor: 0,
        nitrousCharge: 1,
        boostActive: false,
        lap: 2,
        trackProgress: 0.3,
      },
      'rival-1': {
        position: new THREE.Vector3(),
        heading: 0,
        speed: 45,
        driftFactor: 0,
        nitrousCharge: 1,
        boostActive: false,
        lap: 1,
        trackProgress: 0.9,
      },
    };

    director.update(0.016, undefined, carMap);

    expect(director.state.standings[0].carId).toBe('player');
    expect(director.state.standings[0].lap).toBe(2);
    expect(director.state.standings[1].carId).toBe('rival-1');
    expect(director.state.standings[1].lap).toBe(1);

    director.dispose();
  });
});

describe('Full synthetic three-lap race simulation', () => {
  it('runs a complete 3-lap simulation with 4 racers from countdown to finish', () => {
    const raceFinishedSpy = jest.fn();
    const lapCompleteSpy = jest.fn();

    const director = createRaceDirector({
      totalLaps: 3,
      countdownSeconds: 3,
      racers: ['player', 'rival-1', 'rival-2', 'rival-3'],
      onRaceFinished: raceFinishedSpy,
      onLapComplete: lapCompleteSpy,
    });

    // 1. Initial Countdown
    expect(director.state.phase).toBe('countdown');
    expect(director.state.countdown).toBe(3);

    // Advance 3 seconds -> countdown ends, racing begins
    director.update(3.0);
    expect(director.state.phase).toBe('racing');
    expect(director.state.countdown).toBe(0);
    expect(director.state.elapsedSeconds).toBe(0);

    // Simulate 60 Hz physics ticks over a 90-second race
    const dt = 1 / 60;
    // Speeds: player travels 1 lap in ~20s, rival-1 in ~22s, rival-2 in ~25s, rival-3 in ~28s
    const speeds = {
      player: 1 / 20, // 0.05 laps per sec
      'rival-1': 1 / 22,
      'rival-2': 1 / 25,
      'rival-3': 1 / 28,
    };

    const progress = {
      player: 0,
      'rival-1': 0,
      'rival-2': 0,
      'rival-3': 0,
    };

    // Simulate up to 100 seconds (6000 frames)
    for (let frame = 0; frame < 6000; frame++) {
      if (director.state.phase === 'finished') break;

      director.update(dt);

      for (const [id, speed] of Object.entries(speeds)) {
        progress[id as keyof typeof progress] += speed * dt;
        director.updateRacerProgress(id, progress[id as keyof typeof progress]);
      }
    }

    // Race must have finished
    expect(director.state.phase).toBe('finished');
    expect(raceFinishedSpy).toHaveBeenCalled();

    // Verify final standings order: Player 1st, Rival 1 2nd, Rival 2 3rd, Rival 3 4th
    const finalStandings = director.state.standings;
    expect(finalStandings[0].carId).toBe('player');
    expect(finalStandings[0].position).toBe(1);
    expect(finalStandings[0].lap).toBe(3);
    expect(director.getFinishTime('player')).toBeCloseTo(60.0, 0); // 3 laps * 20s = 60s

    const playerLapTimes = director.getLapTimes('player');
    expect(playerLapTimes).toHaveLength(3);
    for (const lapTime of playerLapTimes) {
      expect(lapTime).toBeCloseTo(20.0, 0);
    }
    expect(director.getBestLapTime('player')).toBeCloseTo(20.0, 0);

    director.dispose();
  });
});

describe('Lifecycle management (reset, dynamic registration, checkpoint events)', () => {
  it('resets race state cleanly back to initial state', () => {
    const director = createRaceDirector({
      countdownSeconds: 3,
      totalLaps: 3,
      racers: ['player', 'rival-1'],
    });

    director.startRace();
    director.update(15.0);
    director.onCarCrossStartLine('player');

    expect(director.state.phase).toBe('racing');
    expect(director.state.elapsedSeconds).toBe(15.0);
    expect(director.state.standings[0].lap).toBe(2);

    director.reset();

    expect(director.state.phase).toBe('countdown');
    expect(director.state.countdown).toBe(3);
    expect(director.state.elapsedSeconds).toBe(0);
    expect(director.state.standings[0].lap).toBe(1);
    expect(director.state.standings[0].trackProgress).toBe(0);
    expect(director.getLapTimes('player')).toEqual([]);
    expect(director.getBestLapTime('player')).toBeNull();

    director.dispose();
  });

  it('allows dynamic registration and registration update of racers', () => {
    const director = createRaceDirector();
    expect(director.state.standings).toHaveLength(1);

    director.registerRacer({ id: 'rival-x', name: 'Shadow', color: '#ff5500' });
    expect(director.state.standings).toHaveLength(2);
    expect(director.state.standings.find((s) => s.carId === 'rival-x')?.name).toBe('Shadow');

    // Update existing racer config
    director.registerRacer({ id: 'rival-x', name: 'Shadow GT' });
    expect(director.state.standings.find((s) => s.carId === 'rival-x')?.name).toBe('Shadow GT');

    director.dispose();
  });

  it('handles checkpoint events gracefully', () => {
    const director = createRaceDirector();
    director.onCarCrossCheckpoint('player', 1);
    director.onCarCrossCheckpoint('player', 2);
    // Invalid checkpoint index doesn't throw
    director.onCarCrossCheckpoint('player', 99);
    director.onCarCrossCheckpoint('player', -1);
    director.dispose();
  });
});
