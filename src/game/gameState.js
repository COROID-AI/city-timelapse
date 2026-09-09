/**
 * Game states & game-level flow (src/game/gameState.js).
 *
 * Owns the high-level game state machine consumed by src/game/game.js:
 *
 *   TITLE -> PLAYING -> DYING -> PLAYING | GAME_OVER
 *     \                      \-> LEVEL_COMPLETE (via the flag sequence)
 *
 * - TITLE: Enter starts a fresh run.
 * - PLAYING: the playable level. The 400-unit timer ticks one unit every
 *   ~0.4 s and reports a timeout at 0 so composition can kill the player.
 * - DYING: a death is being animated; on completion the run either costs a
 *   life and respawns (PLAYING) or, at 0 lives, reaches GAME_OVER.
 * - LEVEL_COMPLETE: reached only after the flag sequence (pole slide ->
 *   auto-walk to castle -> time bonus 50/unit) has finished; Enter restarts.
 * - GAME_OVER: no lives left; Enter restarts.
 *
 * The module deliberately knows nothing about the player, entities, tiles
 * or rendering — it only tracks score/coins/world/time/lives (the GameStats
 * contract fed straight to drawHud) and the timing/flow rules. game.js
 * drives the world (slide, walk, respawn) from `flagPhase` and the
 * transition callbacks.
 *
 * @module game/gameState
 */

/** Canonical state identifiers (frozen; read by tests and composition). */
export const GAME_STATES = Object.freeze({
  TITLE: 'TITLE',
  PLAYING: 'PLAYING',
  DYING: 'DYING',
  LEVEL_COMPLETE: 'LEVEL_COMPLETE',
  GAME_OVER: 'GAME_OVER',
});

/** Fraction of a real second each timer unit costs (~0.4 s per unit). */
export const TIME_PER_TICK_SECONDS = 0.4;

/** Score awarded per remaining time unit when the flag sequence finishes. */
export const TIME_BONUS_PER_UNIT = 50;

/** Auto-walk phase identifiers used by composition to drive the finish. */
const FLAG_PHASE_NONE = 'none';
const FLAG_PHASE_SLIDE = 'slide';
const FLAG_PHASE_WALK = 'walk';
const FLAG_PHASE_DONE = 'done';

/**
 * Create the game-level state machine.
 *
 * @param {object} [options]
 * @param {object} [options.level] Level config consumed for spawn + the
 *   default time limit: `{ spawn: {x, y}, timeLimit }`.
 * @param {number} [options.initialLives=3] Lives granted per fresh run.
 * @param {number} [options.initialTime] Starting timer value; defaults to
 *   `level.timeLimit ?? 400`.
 * @param {number} [options.timePerTickSeconds=0.4] Timer tick period.
 * @param {number} [options.timeBonusPerUnit=50] Flag-complete bonus scale.
 * @param {string} [options.world='1-1'] World label rendered by the HUD.
 * @param {function} [options.onTransition] (fromState, toState) => void.
 * @returns {GameStateHandle}
 */
export function createGameState({
  level = {},
  initialLives = 3,
  initialTime = null,
  timePerTickSeconds = TIME_PER_TICK_SECONDS,
  timeBonusPerUnit = TIME_BONUS_PER_UNIT,
  world = '1-1',
  onTransition = null,
} = {}) {
  const spawn = level.spawn || { x: 0, y: 0 };
  const spawnTime = initialTime == null ? (level.timeLimit ?? 400) : initialTime;

  let state = GAME_STATES.TITLE;
  let score = 0;
  let coinCount = 0;
  let lives = initialLives;
  let time = spawnTime;
  let timeAccumulator = 0;
  let flagPhase = FLAG_PHASE_NONE;

  function setState(next) {
    if (next === state) return;
    const prev = state;
    state = next;
    if (typeof onTransition === 'function') {
      onTransition(prev, next);
    }
  }

  /** Reset every run-scoped value, then start playing. */
  function reset() {
    score = 0;
    coinCount = 0;
    lives = initialLives;
    time = spawnTime;
    timeAccumulator = 0;
    flagPhase = FLAG_PHASE_NONE;
    setState(GAME_STATES.PLAYING);
  }

  /**
   * The Enter/start action: begins a fresh run from TITLE, or restarts from
   * LEVEL_COMPLETE / GAME_OVER. Ignored mid-run (PLAYING / DYING).
   */
  function pressStart() {
    if (
      state === GAME_STATES.TITLE ||
      state === GAME_STATES.LEVEL_COMPLETE ||
      state === GAME_STATES.GAME_OVER
    ) {
      reset();
    }
  }

  /**
   * Register that a death has begun (player entered its dead state).
   * Freezes the timer and flag flow; composition keeps animating the death.
   */
  function beginDeath() {
    if (state !== GAME_STATES.PLAYING) return;
    flagPhase = FLAG_PHASE_NONE;
    setState(GAME_STATES.DYING);
  }

  /**
   * Called when the death animation has finished. Costs one life: with
   * lives remaining the run continues from the level spawn (PLAYING), and
   * at 0 lives the run ends (GAME_OVER).
   */
  function onDeathAnimationComplete() {
    if (state !== GAME_STATES.DYING) return;
    lives -= 1;
    if (lives <= 0) {
      lives = 0;
      setState(GAME_STATES.GAME_OVER);
    } else {
      time = spawnTime;
      timeAccumulator = 0;
      flagPhase = FLAG_PHASE_NONE;
      setState(GAME_STATES.PLAYING);
    }
  }

  /**
   * Flagpole contact: player slid onto the pole (classic level finish).
   * The state stays PLAYING while composition choreographs the slide; the
   * timer is paused for the whole sequence via `flagPhase`.
   */
  function beginFlagSequence() {
    if (state !== GAME_STATES.PLAYING) return;
    flagPhase = FLAG_PHASE_SLIDE;
  }

  /** Landed at the pole base: the slide finished, walk toward the castle. */
  function flagSlideLanded() {
    if (state !== GAME_STATES.PLAYING || flagPhase !== FLAG_PHASE_SLIDE) return;
    flagPhase = FLAG_PHASE_WALK;
  }

  /**
   * Reached the castle door: award the time bonus (50/unit of remaining
   * timer) and enter LEVEL_COMPLETE.
   */
  function completeFlagWalk() {
    if (state !== GAME_STATES.PLAYING || flagPhase !== FLAG_PHASE_WALK) return;
    score += Math.max(0, time) * timeBonusPerUnit;
    flagPhase = FLAG_PHASE_DONE;
    setState(GAME_STATES.LEVEL_COMPLETE);
  }

  /** Add positive score (used by every entity-manager scoring hook). */
  function addScore(amount) {
    score += Math.max(0, Math.floor(Number(amount) || 0));
  }

  /** Add `count` collected coins (default 1). */
  function addCoin(count = 1) {
    coinCount += Math.max(0, Math.floor(Number(count) || 0));
  }

  /**
   * Advance the run clock by one fixed simulation step.
   *
   * Only ticks while PLAYING and outside the flag sequence. Returns
   * 'timeout' exactly once when the timer reaches 0, so composition can
   * kill the player; the timer then stays pinned at 0 until the death flow
   * runs (constant 0 keeps the math safe).
   *
   * @param {number} dt fixed step duration in seconds.
   * @returns {'idle'|'timeout'}
   */
  function update(dt) {
    if (state !== GAME_STATES.PLAYING || flagPhase !== FLAG_PHASE_NONE) {
      return 'idle';
    }
    timeAccumulator += Math.max(0, dt);
    let timedOut = false;
    while (timeAccumulator >= timePerTickSeconds) {
      timeAccumulator -= timePerTickSeconds;
      time = Math.max(0, time - 1);
      if (time === 0) {
        timedOut = true;
        break;
      }
    }
    return timedOut ? 'timeout' : 'idle';
  }

  return {
    /** Current top-level state (GAME_STATES member). */
    get state() {
      return state;
    },
    /**
     * Finish-sequence sub-state: 'none' | 'slide' | 'walk' | 'done'.
     * Composition reads this to choreograph the flagpole → castle flow.
     */
    get flagPhase() {
      return flagPhase;
    },
    /** Live GameStats contract {score, coins, world, time, lives} for drawHud. */
    get stats() {
      return {
        score,
        coins: coinCount,
        world,
        time,
        lives,
      };
    },
    get spawn() {
      return spawn;
    },
    get spawnTime() {
      return spawnTime;
    },
    reset,
    pressStart,
    beginDeath,
    onDeathAnimationComplete,
    beginFlagSequence,
    flagSlideLanded,
    completeFlagWalk,
    addScore,
    addCoin,
    update,
  };
}

export default createGameState;