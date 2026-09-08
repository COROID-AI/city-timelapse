// Pure race controller: lap counting (checkpoint-guarded against line-spam /
// reverse-cheating), per-lap splits, total elapsed timer, finish at N laps,
// and live standings ordering. No three.js import.

const START_SECTOR = 0.25; // crossing the line within this route-fraction band counts
const HALF_LAP = 0.5; // must pass the halfway checkpoint before a lap counts

export class RaceController {
  constructor(config) {
    this.config = config.race;
    this.racers = new Map(); // id -> racer state
    this.orderedIds = []; // insertion order of registration
    this.completed = false; // race done for the player
    this.reset();
  }

  reset() {
    this.racers.forEach((r) => {
      r.laps = 0;
      r.progress = 0;
      r.checkpoint = false;
      r.lapStart = 0;
      r.lapTimes = [];
      r.totalTime = 0;
      r.finished = false;
      r.finishOrder = null;
    });
    this.totalElapsed = 0;
    this.completed = false;
    this._finishCounter = 0;
  }

  registerRacer(id) {
    if (!this.racers.has(id)) {
      this.racers.set(id, {
        id,
        laps: 0,
        progress: 0,
        checkpoint: false,
        lapStart: 0,
        lapTimes: [],
        totalTime: 0,
        finished: false,
        finishOrder: null,
      });
      this.orderedIds.push(id);
    }
    return this.racers.get(id);
  }

  /**
   * Advance a racer given its route progress fraction t in [0,1).
   * @returns {lapChanged, finished} describing what happened.
   */
  updateProgress(id, t) {
    const r = this.racers.get(id);
    if (!r || r.finished) return { lapChanged: false, finished: false };

    // Route wrap detection: t jumps backwards across the loop seam (t ~0).
    // A crossing counts as a lap only if the racer has passed the half-lap
    // checkpoint since the last crossing.
    const prev = r.progress;
    const wrapped = prev > 0.85 && t < 0.15;
    let lapChanged = false;

    if (wrapped) {
      if (r.checkpoint) {
        r.laps += 1;
        const now = this.totalElapsed;
        r.lapTimes.push(now - r.lapStart);
        r.lapStart = now;
        r.totalTime = now;
        r.checkpoint = false;
        lapChanged = true;
        if (r.laps >= this.config.laps) {
          r.finished = true;
          r.finishOrder = ++this._finishCounter;
          if (id !== 'player') this.completed = true; // final racer finished
        }
      }
    } else if (t >= HALF_LAP) {
      r.checkpoint = true;
    }

    r.progress = t;
    return { lapChanged, finished: r.finished };
  }

  /**
   * Live standings sorted by (finishOrder for finished, else laps desc, then
   * progress desc, then last-lap time asc). Finished racers rank above live ones.
   */
  standings() {
    const list = this.orderedIds.map((id) => this.racers.get(id));
    list.sort((a, b) => {
      if (a.finished && b.finished) return a.finishOrder - b.finishOrder;
      if (a.finished) return -1;
      if (b.finished) return 1;
      if (a.laps !== b.laps) return b.laps - a.laps;
      if (Math.abs(a.progress - b.progress) > 1e-6) return b.progress - a.progress;
      const at = a.lapTimes[a.lapTimes.length - 1] ?? Infinity;
      const bt = b.lapTimes[b.lapTimes.length - 1] ?? Infinity;
      return at - bt;
    });
    return list;
  }

  tick(dt) {
    if (!this.completed) this.totalElapsed += dt;
  }
}