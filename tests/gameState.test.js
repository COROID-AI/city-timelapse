/**
 * Unit and state-machine tests for GameState (src/game/gameState.js).
 *
 * Verifies:
 *  - GAME_STATES enum definition and immutability
 *  - State transitions: TITLE -> PLAYING -> DYING -> PLAYING | GAME_OVER
 *  - pressStart starts a fresh run from TITLE, GAME_OVER or LEVEL_COMPLETE
 *  - Timer countdown at 0.4s/unit, pausing during non-playing / flag states
 *  - Timeout triggers death signal at time = 0
 *  - Flag sequence: beginFlagSequence -> slide -> walk -> completeFlagWalk (50 pts / unit time bonus)
 *  - Death handling, lives depletion, respawn vs game over transitions
 *  - Score and coin counter mutations
 */

import {
  createGameState,
  GAME_STATES,
  TIME_PER_TICK_SECONDS,
  TIME_BONUS_PER_UNIT,
} from '../src/game/gameState.js';

describe('GameState Machine (src/game/gameState.js)', () => {
  test('GAME_STATES exports frozen canonical state identifiers', () => {
    expect(GAME_STATES).toEqual({
      TITLE: 'TITLE',
      PLAYING: 'PLAYING',
      DYING: 'DYING',
      LEVEL_COMPLETE: 'LEVEL_COMPLETE',
      GAME_OVER: 'GAME_OVER',
    });
    expect(Object.isFrozen(GAME_STATES)).toBe(true);
  });

  test('initializes on TITLE screen with default stats', () => {
    const gs = createGameState({ initialLives: 3, initialTime: 400, world: '1-1' });
    expect(gs.state).toBe(GAME_STATES.TITLE);
    expect(gs.stats).toEqual({
      score: 0,
      coins: 0,
      world: '1-1',
      time: 400,
      lives: 3,
    });
    expect(gs.flagPhase).toBe('none');
  });

  test('pressStart transitions from TITLE to PLAYING and resets stats', () => {
    const transitions = [];
    const gs = createGameState({
      initialLives: 3,
      initialTime: 400,
      onTransition: (from, to) => transitions.push({ from, to }),
    });

    gs.pressStart();
    expect(gs.state).toBe(GAME_STATES.PLAYING);
    expect(transitions).toEqual([{ from: GAME_STATES.TITLE, to: GAME_STATES.PLAYING }]);
    expect(gs.stats.lives).toBe(3);
    expect(gs.stats.time).toBe(400);
    expect(gs.stats.score).toBe(0);
  });

  test('scoring and coin increments update live GameStats', () => {
    const gs = createGameState();
    gs.pressStart();

    gs.addScore(100);
    gs.addScore(200);
    expect(gs.stats.score).toBe(300);

    gs.addCoin();
    gs.addCoin(2);
    expect(gs.stats.coins).toBe(3);
  });

  test('timer ticks ~1 unit per 0.4 seconds while PLAYING', () => {
    const gs = createGameState({ initialTime: 400, timePerTickSeconds: 0.4 });
    gs.pressStart();

    // Advance 0.2s -> no timer change yet
    let res = gs.update(0.2);
    expect(res).toBe('idle');
    expect(gs.stats.time).toBe(400);

    // Advance another 0.2s (total 0.4s) -> time decrements by 1
    res = gs.update(0.2);
    expect(res).toBe('idle');
    expect(gs.stats.time).toBe(399);

    // Advance 0.8s -> decrements by 2
    res = gs.update(0.8);
    expect(res).toBe('idle');
    expect(gs.stats.time).toBe(397);
  });

  test('timer reaching 0 returns timeout and freezes at 0', () => {
    const gs = createGameState({ initialTime: 2, timePerTickSeconds: 0.1 });
    gs.pressStart();

    expect(gs.update(0.1)).toBe('idle');
    expect(gs.stats.time).toBe(1);

    // Final unit tick -> triggers timeout
    expect(gs.update(0.1)).toBe('timeout');
    expect(gs.stats.time).toBe(0);

    // Subsequent updates stay at 0
    expect(gs.update(0.1)).toBe('timeout');
    expect(gs.stats.time).toBe(0);
  });

  test('timer is paused during TITLE, DYING, LEVEL_COMPLETE, and flag sequence', () => {
    const gs = createGameState({ initialTime: 400 });

    // In TITLE
    gs.update(10.0);
    expect(gs.stats.time).toBe(400);

    // Start playing
    gs.pressStart();
    gs.update(0.4);
    expect(gs.stats.time).toBe(399);

    // Enter flag sequence
    gs.beginFlagSequence();
    gs.update(5.0);
    expect(gs.stats.time).toBe(399); // paused during slide/walk

    // In DYING
    const dyingGs = createGameState({ initialTime: 300 });
    dyingGs.pressStart();
    dyingGs.beginDeath();
    dyingGs.update(5.0);
    expect(dyingGs.stats.time).toBe(300);
  });

  test('flag sequence: slide -> walk -> complete awards 50 pts per remaining time unit', () => {
    const transitions = [];
    const gs = createGameState({
      initialTime: 400,
      timeBonusPerUnit: TIME_BONUS_PER_UNIT,
      onTransition: (from, to) => transitions.push({ from, to }),
    });

    gs.pressStart();
    gs.addScore(1000);
    // Advance timer so remaining time is 350
    for (let i = 0; i < 50; i++) {
      gs.update(0.4);
    }
    expect(gs.stats.time).toBe(350);

    // 1. Pole contact -> beginFlagSequence
    gs.beginFlagSequence();
    expect(gs.flagPhase).toBe('slide');
    expect(gs.state).toBe(GAME_STATES.PLAYING);

    // 2. Slide lands -> flagSlideLanded
    gs.flagSlideLanded();
    expect(gs.flagPhase).toBe('walk');

    // 3. Castle reached -> completeFlagWalk
    gs.completeFlagWalk();
    expect(gs.flagPhase).toBe('done');
    expect(gs.state).toBe(GAME_STATES.LEVEL_COMPLETE);

    // Bonus score = 350 * 50 = 17,500; total = 1000 + 17,500 = 18,500
    expect(gs.stats.score).toBe(1000 + 350 * 50);
    expect(transitions).toContainEqual({
      from: GAME_STATES.PLAYING,
      to: GAME_STATES.LEVEL_COMPLETE,
    });
  });

  test('death costs 1 life and respawns when lives remain', () => {
    const gs = createGameState({ initialLives: 3, initialTime: 400 });
    gs.pressStart();

    // Player takes fatal hit
    gs.beginDeath();
    expect(gs.state).toBe(GAME_STATES.DYING);

    // Death animation finishes -> respawns at level spawn
    gs.onDeathAnimationComplete();
    expect(gs.state).toBe(GAME_STATES.PLAYING);
    expect(gs.stats.lives).toBe(2);
    expect(gs.stats.time).toBe(400); // timer reset on respawn
  });

  test('death with 1 life remaining transitions to GAME_OVER at 0 lives', () => {
    const transitions = [];
    const gs = createGameState({
      initialLives: 1,
      onTransition: (from, to) => transitions.push({ from, to }),
    });

    gs.pressStart();
    expect(gs.stats.lives).toBe(1);

    gs.beginDeath();
    expect(gs.state).toBe(GAME_STATES.DYING);

    gs.onDeathAnimationComplete();
    expect(gs.state).toBe(GAME_STATES.GAME_OVER);
    expect(gs.stats.lives).toBe(0);
    expect(transitions).toContainEqual({
      from: GAME_STATES.DYING,
      to: GAME_STATES.GAME_OVER,
    });
  });

  test('pressStart from GAME_OVER or LEVEL_COMPLETE resets and starts a fresh run', () => {
    const gs = createGameState({ initialLives: 1 });
    gs.pressStart();
    gs.addScore(500);
    gs.beginDeath();
    gs.onDeathAnimationComplete();
    expect(gs.state).toBe(GAME_STATES.GAME_OVER);

    // Restart fresh
    gs.pressStart();
    expect(gs.state).toBe(GAME_STATES.PLAYING);
    expect(gs.stats.lives).toBe(1);
    expect(gs.stats.score).toBe(0);
  });
});
