import type {
  AIState,
  CarState,
  InputState,
  RaceHandle,
  RaceState,
  StandingEntry,
  TrackData,
} from './contracts';

/** Default total laps for a race. */
export const DEFAULT_TOTAL_LAPS = 3;

/** Default countdown duration in seconds. */
export const DEFAULT_COUNTDOWN_SECONDS = 3;

/** Vibrant neon color palette for player and AI rivals. */
export const NEON_RACER_COLORS: readonly string[] = [
  '#00ffff', // Neon Cyan (Player)
  '#ff007f', // Neon Magenta (Rival 1)
  '#39ff14', // Neon Green (Rival 2)
  '#ffe600', // Neon Yellow (Rival 3)
  '#ff7700', // Neon Orange (Rival 4)
  '#a855f7', // Neon Purple (Rival 5)
  '#00f0ff', // Electric Blue (Rival 6)
  '#ff0055', // Neon Crimson (Rival 7)
];

/** Extended standing entry that includes UI display fields: position, name, and color. */
export interface StandingEntryExtended extends StandingEntry {
  /** 1-based leaderboard position (1, 2, 3, ...). */
  position: number;
  /** Racer display name. */
  name: string;
  /** Racer hex color for HUD/standings display. */
  color: string;
  /** True if this racer is the player car. */
  isPlayer?: boolean;
  /** Race elapsed time when this racer completed the final lap, or null if still racing. */
  finishTime?: number | null;
  /** Array of recorded lap times in seconds for completed laps. */
  lapTimes?: number[];
}

/** Extended race state snapshot with rich StandingEntryExtended standings. */
export interface ExtendedRaceState extends RaceState {
  /** Current standings, ordered best-first with position/name/color metadata. */
  standings: StandingEntryExtended[];
}

/** Racer configuration options. */
export interface RacerConfig {
  /** Unique car identifier (e.g. 'player', 'rival-1'). */
  id: string;
  /** Display name (e.g. 'Player', 'Apex'). */
  name?: string;
  /** Hex color string (e.g. '#00ffff'). */
  color?: string;
  /** True if this car is the player. */
  isPlayer?: boolean;
}

/** Progress snapshot for a racer passed into update(). */
export interface RacerProgressSnapshot {
  carId: string;
  state: CarState;
  aiState?: AIState;
}

/** Configuration options for createRaceDirector. */
export interface RaceDirectorOptions {
  /** Track data containing checkpoints and racing line. */
  track?: TrackData;
  /** Total number of laps (default: 3). */
  totalLaps?: number;
  /** Start countdown duration in seconds (default: 3). */
  countdownSeconds?: number;
  /** List of racer configs or racer IDs. */
  racers?: Array<RacerConfig | string>;
  /** Start directly in 'racing' phase instead of 'countdown'. */
  autoStart?: boolean;
  /** Callback fired when the race phase changes. */
  onPhaseChange?: (phase: RaceState['phase']) => void;
  /** Callback fired when a car completes a lap. */
  onLapComplete?: (carId: string, completedLap: number, lapTimeSeconds: number) => void;
  /** Callback fired when the race finishes. */
  onRaceFinished?: (standings: StandingEntryExtended[]) => void;
}

/** Race director handle returned by createRaceDirector. */
export interface RaceDirectorHandle extends RaceHandle {
  /** Authoritative race runtime state snapshot. */
  readonly state: ExtendedRaceState;
  /** Advance the race simulation by deltaSeconds. */
  update: (
    deltaSeconds: number,
    input?: InputState,
    racerSnapshots?:
      | Record<string, CarState>
      | RacerProgressSnapshot[]
      | Array<CarState & { carId?: string }>,
  ) => void;
  /** Start line crossing event. */
  onCarCrossStartLine: (carId: string) => void;
  /** Checkpoint crossing event. */
  onCarCrossCheckpoint: (carId: string, checkpointIndex: number) => void;
  /** Update progress for an individual racer. */
  updateRacerProgress: (
    carId: string,
    progress: number,
    options?: { lap?: number; carState?: CarState; aiState?: AIState },
  ) => void;
  /** Register or update a racer's configuration. */
  registerRacer: (racer: RacerConfig | string) => void;
  /** Get all recorded lap times for a racer. */
  getLapTimes: (carId: string) => number[];
  /** Get final race finish time in seconds for a racer, or null if unfinished. */
  getFinishTime: (carId: string) => number | null;
  /** Get fastest lap time for a racer, or null if no lap completed yet. */
  getBestLapTime: (carId: string) => number | null;
  /** Skip countdown and immediately begin racing. */
  startRace: () => void;
  /** Complete and finish the race immediately. */
  finishRace: () => void;
  /** Reset race state back to initial countdown. */
  reset: () => void;
  /** Clean up resources and detach listeners. */
  dispose: () => void;
}

/**
 * Format a time in seconds to mm:ss.cs (minutes, seconds, centiseconds).
 * Examples:
 *   0 -> "00:00.00"
 *   5.25 -> "00:05.25"
 *   65.4 -> "01:05.40"
 *   125.07 -> "02:05.07"
 *
 * @param seconds Time in seconds (clamped to >= 0, handles non-finite gracefully).
 * @returns Formatted time string in mm:ss.cs format.
 */
export function formatRaceTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '00:00.00';
  }
  const hundredths = Math.floor(seconds * 100 + 1e-6);
  const minutes = Math.floor(hundredths / 6000);
  const secs = Math.floor((hundredths % 6000) / 100);
  const cs = hundredths % 100;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const csStr = String(cs).padStart(2, '0');
  return `${mm}:${ss}.${csStr}`;
}

/** Alias helpers for formatRaceTime so downstream modules and HUD can import by preferred name. */
export const formatTime = formatRaceTime;
export const formatLapTime = formatRaceTime;
export const formatMmSsCs = formatRaceTime;

/** Internal tracking structure for each registered racer. */
interface InternalRacer {
  id: string;
  name: string;
  color: string;
  isPlayer: boolean;
  currentLap: number;
  trackProgress: number;
  lastTrackProgress: number;
  maxForwardProgress: number;
  lapStartTime: number;
  lapTimes: number[];
  bestLapSeconds: number | null;
  finishTime: number | null;
  finished: boolean;
  checkpointsVisited: boolean[];
  registrationOrder: number;
}

/**
 * Create a pure race director instance.
 *
 * Manages countdown, 3-lap progression, elapsed & per-lap timing,
 * checkpoint cycle tracking, and live standings calculation.
 *
 * @param trackOrOptions TrackData or RaceDirectorOptions
 * @param maybeOptions Optional RaceDirectorOptions when track is passed as first param
 */
export function createRaceDirector(
  trackOrOptions?: TrackData | RaceDirectorOptions,
  maybeOptions?: RaceDirectorOptions,
): RaceDirectorHandle {
  let track: TrackData | undefined;
  let options: RaceDirectorOptions = {};

  if (trackOrOptions) {
    if ('waypoints' in trackOrOptions || 'startLine' in trackOrOptions) {
      track = trackOrOptions as TrackData;
      options = maybeOptions ?? {};
    } else {
      options = trackOrOptions as RaceDirectorOptions;
      track = options.track;
    }
  }

  const totalLaps =
    typeof options.totalLaps === 'number' && options.totalLaps > 0
      ? options.totalLaps
      : DEFAULT_TOTAL_LAPS;

  const initialCountdownSeconds =
    typeof options.countdownSeconds === 'number' && options.countdownSeconds >= 0
      ? options.countdownSeconds
      : DEFAULT_COUNTDOWN_SECONDS;

  const numCheckpoints =
    track?.checkpoints && track.checkpoints.length > 0 ? track.checkpoints.length : 4;

  let phase: RaceState['phase'] = options.autoStart ? 'racing' : 'countdown';
  let countdown = options.autoStart ? 0 : initialCountdownSeconds;
  let elapsedSeconds = 0;
  let disposed = false;
  let orderCounter = 0;

  const racers = new Map<string, InternalRacer>();

  const getRacerDefaultInfo = (
    id: string,
    index: number,
  ): { name: string; color: string; isPlayer: boolean } => {
    const isPlayer = id === 'player' || id.toLowerCase().includes('player');
    let color: string;
    let name: string;

    if (isPlayer) {
      color = NEON_RACER_COLORS[0];
      name = 'Player';
    } else {
      const colorIndex = (index + 1) % NEON_RACER_COLORS.length;
      color = NEON_RACER_COLORS[colorIndex];
      const rivalMatch = id.match(/rival[-_]?(\d+)/i) || id.match(/ai[-_]?(\d+)/i);
      if (rivalMatch) {
        name = `Rival ${rivalMatch[1]}`;
      } else {
        name = id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' ');
      }
    }
    return { name, color, isPlayer };
  };

  const registerRacerInternal = (racerConfig: RacerConfig | string): InternalRacer => {
    const id = typeof racerConfig === 'string' ? racerConfig : racerConfig.id;
    const existing = racers.get(id);
    if (existing) {
      if (typeof racerConfig !== 'string') {
        if (racerConfig.name !== undefined) existing.name = racerConfig.name;
        if (racerConfig.color !== undefined) existing.color = racerConfig.color;
        if (racerConfig.isPlayer !== undefined) existing.isPlayer = racerConfig.isPlayer;
      }
      return existing;
    }

    const defaultInfo = getRacerDefaultInfo(id, racers.size);
    const name =
      typeof racerConfig !== 'string' && racerConfig.name !== undefined
        ? racerConfig.name
        : defaultInfo.name;
    const color =
      typeof racerConfig !== 'string' && racerConfig.color !== undefined
        ? racerConfig.color
        : defaultInfo.color;
    const isPlayer =
      typeof racerConfig !== 'string' && racerConfig.isPlayer !== undefined
        ? racerConfig.isPlayer
        : defaultInfo.isPlayer;

    const visited = new Array(numCheckpoints).fill(false);

    const newRacer: InternalRacer = {
      id,
      name,
      color,
      isPlayer,
      currentLap: 1,
      trackProgress: 0,
      lastTrackProgress: 0,
      maxForwardProgress: 0,
      lapStartTime: 0,
      lapTimes: [],
      bestLapSeconds: null,
      finishTime: null,
      finished: false,
      checkpointsVisited: visited,
      registrationOrder: ++orderCounter,
    };

    racers.set(id, newRacer);
    return newRacer;
  };

  // Seed racers from options
  if (options.racers && options.racers.length > 0) {
    for (const r of options.racers) {
      registerRacerInternal(r);
    }
  } else {
    // Default seed: 'player'
    registerRacerInternal('player');
  }

  const getOrCreateRacer = (id: string): InternalRacer => {
    const existing = racers.get(id);
    if (existing) return existing;
    return registerRacerInternal(id);
  };

  const checkRaceFinished = () => {
    if (phase === 'finished') return;

    const racerList = Array.from(racers.values());
    if (racerList.length === 0) return;

    const playerRacer = racerList.find((r) => r.isPlayer);
    const allFinished = racerList.every((r) => r.finished);

    if (playerRacer ? playerRacer.finished : allFinished) {
      phase = 'finished';
      options.onPhaseChange?.('finished');
      options.onRaceFinished?.(buildStandings());
    }
  };

  const completeLap = (racer: InternalRacer) => {
    if (racer.finished) return;

    const lapDuration = Math.max(0, elapsedSeconds - racer.lapStartTime);
    racer.lapTimes.push(lapDuration);

    if (racer.bestLapSeconds === null || lapDuration < racer.bestLapSeconds) {
      racer.bestLapSeconds = lapDuration;
    }

    const completedLapNum = racer.currentLap;

    if (racer.currentLap < totalLaps) {
      racer.currentLap += 1;
      racer.lapStartTime = elapsedSeconds;
      racer.maxForwardProgress = 0;
      racer.checkpointsVisited = new Array(numCheckpoints).fill(false);
      options.onLapComplete?.(racer.id, completedLapNum, lapDuration);
    } else {
      racer.finished = true;
      racer.finishTime = elapsedSeconds;
      options.onLapComplete?.(racer.id, completedLapNum, lapDuration);
      checkRaceFinished();
    }
  };

  const onCarCrossCheckpoint = (carId: string, checkpointIndex: number) => {
    if (disposed) return;
    const racer = getOrCreateRacer(carId);
    if (checkpointIndex >= 0 && checkpointIndex < numCheckpoints) {
      racer.checkpointsVisited[checkpointIndex] = true;
      const cpProgress = (checkpointIndex + 1) / numCheckpoints;
      racer.maxForwardProgress = Math.max(racer.maxForwardProgress, cpProgress);
    }
  };

  const onCarCrossStartLine = (carId: string) => {
    if (disposed) return;
    const racer = getOrCreateRacer(carId);
    if (racer.finished) return;

    if (phase === 'racing') {
      completeLap(racer);
    }
  };

  const processRacerProgress = (
    carId: string,
    progress: number,
    lapOverride?: number,
  ) => {
    const racer = getOrCreateRacer(carId);
    if (racer.finished) return;

    // Clamp progress to [0, 1)
    let normProgress = progress % 1;
    if (normProgress < 0) normProgress += 1;

    const prevProgress = racer.lastTrackProgress;
    racer.lastTrackProgress = normProgress;
    racer.trackProgress = normProgress;

    // Check for explicit lap jump
    if (typeof lapOverride === 'number' && lapOverride > racer.currentLap) {
      while (racer.currentLap < lapOverride && !racer.finished) {
        completeLap(racer);
      }
      return;
    }

    const sector = Math.floor(normProgress * numCheckpoints) % numCheckpoints;

    // Forward progression tracking
    const delta = normProgress - prevProgress;
    if (delta >= 0 && delta < 0.5) {
      racer.checkpointsVisited[sector] = true;
      if (normProgress > racer.maxForwardProgress) {
        racer.maxForwardProgress = normProgress;
      }
    } else if (prevProgress > 0.7 && normProgress < 0.3) {
      // Forward wrap-around across start/finish line
      const visitedCount = racer.checkpointsVisited.filter(Boolean).length;
      const reachedLateTrack = racer.maxForwardProgress >= 0.7;
      const minRequired = Math.max(1, Math.floor(numCheckpoints * 0.5));

      if (phase === 'racing' && (reachedLateTrack || visitedCount >= minRequired)) {
        completeLap(racer);
        racer.maxForwardProgress = normProgress;
        racer.checkpointsVisited[sector] = true;
      }
    }
  };

  const updateRacerProgress = (
    carId: string,
    progress: number,
    opt?: { lap?: number; carState?: CarState; aiState?: AIState },
  ) => {
    if (disposed) return;
    processRacerProgress(carId, progress, opt?.lap);
  };

  const sortRacers = (a: InternalRacer, b: InternalRacer): number => {
    // 1. Finished racers are placed ahead of unfinished racers
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;

    // 2. Both finished: sort by finishTime ascending (lower is faster)
    if (a.finished && b.finished) {
      const timeA = a.finishTime ?? Infinity;
      const timeB = b.finishTime ?? Infinity;
      if (Math.abs(timeA - timeB) > 1e-6) return timeA - timeB;
      return a.registrationOrder - b.registrationOrder;
    }

    // 3. Both unfinished: sort by lap descending (higher lap is ahead)
    if (a.currentLap !== b.currentLap) {
      return b.currentLap - a.currentLap;
    }

    // 4. Same lap: sort by trackProgress descending (higher progress is ahead)
    if (Math.abs(b.trackProgress - a.trackProgress) > 1e-6) {
      return b.trackProgress - a.trackProgress;
    }

    // 5. Stable tie breaker: registration order
    return a.registrationOrder - b.registrationOrder;
  };

  const buildStandings = (): StandingEntryExtended[] => {
    const list = Array.from(racers.values());
    list.sort(sortRacers);

    return list.map((racer, index) => {
      const totalSec = racer.finished
        ? (racer.finishTime ?? elapsedSeconds)
        : elapsedSeconds;

      return {
        carId: racer.id,
        lap: racer.currentLap,
        trackProgress: racer.trackProgress,
        bestLapSeconds: racer.bestLapSeconds,
        totalSeconds: totalSec,
        position: index + 1,
        name: racer.name,
        color: racer.color,
        isPlayer: racer.isPlayer,
        finishTime: racer.finishTime,
        lapTimes: [...racer.lapTimes],
      };
    });
  };

  const buildLapTimers = (): Record<string, number> => {
    const timers: Record<string, number> = {};
    for (const racer of racers.values()) {
      if (phase === 'countdown') {
        timers[racer.id] = 0;
      } else if (racer.finished) {
        const lastLap = racer.lapTimes[racer.lapTimes.length - 1];
        timers[racer.id] = lastLap !== undefined ? lastLap : 0;
      } else {
        timers[racer.id] = Math.max(0, elapsedSeconds - racer.lapStartTime);
      }
    }
    return timers;
  };

  const getSnapshot = (): ExtendedRaceState => {
    return {
      phase,
      countdown,
      totalLaps,
      elapsedSeconds,
      lapTimers: buildLapTimers(),
      standings: buildStandings(),
    };
  };

  const update = (
    deltaSeconds: number,
    _input?: InputState,
    racerSnapshots?:
      | Record<string, CarState>
      | RacerProgressSnapshot[]
      | Array<CarState & { carId?: string }>,
  ): void => {
    if (disposed) return;
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) return;

    if (phase === 'countdown') {
      countdown -= deltaSeconds;
      if (countdown <= 0) {
        countdown = 0;
        phase = 'racing';
        // Reset lap start times when racing begins
        for (const racer of racers.values()) {
          racer.lapStartTime = elapsedSeconds;
        }
        options.onPhaseChange?.('racing');
      }
    } else if (phase === 'racing') {
      elapsedSeconds += deltaSeconds;
    }

    // Process progress snapshots if provided
    if (racerSnapshots) {
      if (Array.isArray(racerSnapshots)) {
        for (const item of racerSnapshots) {
          if ('carId' in item && typeof item.carId === 'string' && 'state' in item) {
            const snap = item as RacerProgressSnapshot;
            processRacerProgress(snap.carId, snap.state.trackProgress, snap.state.lap);
          } else if ('carId' in item && typeof item.carId === 'string') {
            const cs = item as CarState & { carId: string };
            processRacerProgress(cs.carId, cs.trackProgress, cs.lap);
          }
        }
      } else if (typeof racerSnapshots === 'object') {
        for (const [id, carState] of Object.entries(racerSnapshots)) {
          if (carState && typeof carState.trackProgress === 'number') {
            processRacerProgress(id, carState.trackProgress, carState.lap);
          }
        }
      }
    }
  };

  const startRace = () => {
    if (disposed || phase === 'racing' || phase === 'finished') return;
    countdown = 0;
    phase = 'racing';
    for (const racer of racers.values()) {
      racer.lapStartTime = elapsedSeconds;
    }
    options.onPhaseChange?.('racing');
  };

  const finishRace = () => {
    if (disposed || phase === 'finished') return;
    for (const racer of racers.values()) {
      if (!racer.finished) {
        racer.finished = true;
        racer.finishTime = elapsedSeconds;
      }
    }
    phase = 'finished';
    options.onPhaseChange?.('finished');
    options.onRaceFinished?.(buildStandings());
  };

  const reset = () => {
    if (disposed) return;
    phase = options.autoStart ? 'racing' : 'countdown';
    countdown = options.autoStart ? 0 : initialCountdownSeconds;
    elapsedSeconds = 0;
    for (const racer of racers.values()) {
      racer.currentLap = 1;
      racer.trackProgress = 0;
      racer.lastTrackProgress = 0;
      racer.maxForwardProgress = 0;
      racer.lapStartTime = 0;
      racer.lapTimes = [];
      racer.bestLapSeconds = null;
      racer.finishTime = null;
      racer.finished = false;
      racer.checkpointsVisited = new Array(numCheckpoints).fill(false);
    }
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    racers.clear();
  };

  return {
    get state() {
      return getSnapshot();
    },
    update,
    onCarCrossStartLine,
    onCarCrossCheckpoint,
    updateRacerProgress,
    registerRacer: registerRacerInternal,
    getLapTimes: (carId: string) => [...(racers.get(carId)?.lapTimes ?? [])],
    getFinishTime: (carId: string) => racers.get(carId)?.finishTime ?? null,
    getBestLapTime: (carId: string) => racers.get(carId)?.bestLapSeconds ?? null,
    startRace,
    finishRace,
    reset,
    dispose,
  };
}
