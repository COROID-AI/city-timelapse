// Pure AiPacer pacing logic plus the world-facing AiDriver that steers a
// CarPhysics instance around the track curve with a lateral offset. The pure
// pacing math has no three.js import so node:test can cover it.

export class AiPacer {
  constructor(config, skill = 1) {
    this.cfg = config.ai;
    this.skill = skill; // 1 == baseline, <1 slower, >1 faster
    this.baseSpeed = this.cfg.baseSpeed;
  }

  /**
   * Target speed for the AI given the curvature (sharpness of the next curve).
   * - cornerSharpness >= 0, bigger = sharper.
   * - `gap` is (playerRouteFrac - aiRouteFrac) in fractional lap terms, positive
   *   when the AI is behind the player. Rubber-bands on gap.
   */
  targetSpeed(cornerSharpness, gap = 0) {
    let speed = this.baseSpeed * this.skill;
    const sharp = Math.min(1, Math.max(0, cornerSharpness / this.cfg.cornerSharpnessScale));
    // Scrub more speed for sharper corners, scaled by skill stability.
    speed *= 1 - 0.72 * sharp;
    // Rubber-band: lagging AIs push harder; leading AIs ease off to bunch up.
    const gapUnits = gap * 200; // heuristic: 1.0 frac ~ a full circuit
    speed += gapUnits * this.cfg.rubberBandFactor * this.skill;
    return Math.max(this.cfg.minSpeed, Math.min(this.baseSpeed * 1.25, speed));
  }
}

export class AiDriver {
  /**
   * @param {AiPacer} pacer
   * @param {import('./track.js').Track} track
   * @param {import('./car.js').CarPhysics} car
   * @param {RaceController} race
   * @param {object} opts {lateralOffset, routeStartFrac, id}
   */
  constructor(pacer, track, car, race, opts = {}) {
    this.pacer = pacer;
    this.track = track;
    this.car = car;
    this.race = race;
    this.id = opts.id ?? 'ai';
    this.lateralOffset = opts.lateralOffset ?? 0;
    this.startFrac = opts.routeStartFrac ?? 0;
    this.lookahead = this.pacer.cfg.lookahead;
    this.steerGain = this.pacer.cfg.steerGain;
  }

  /** Current route fraction travelled by this AI car. */
  get routeFrac() {
    return this.track.routeFracFor(this.car.position);
  }

  /** Place the car at its staggered starting route position. */
  placeAtStart() {
    const p = this.track.pointAt(this.startFrac, this.lateralOffset);
    this.car.teleport(p.x, p.z, this.track.headingAt(this.startFrac));
  }

  /**
   * Drive one physics step. Computes steering toward a lookahead point with a
   * lateral offset, throttles per pacer target speed, then updates CarPhysics
   * and reports progress to the race controller.
   */
  update(dt, playerRouteFrac, frame = 0) {
    const me = this.routeFrac;
    const gap = playerRouteFrac - me;
    // Lookahead route point, converted to a world target with a lateral bias.
    const aheadFrac = (me + this.lookahead / this.track.totalLength) % 1;
    const target = this.track.pointAt(aheadFrac, this.lateralOffset);

    const dx = target.x - this.car.position.x;
    const dz = target.z - this.car.position.z;
    // Angle difference between desired direction and car heading.
    const desiredHeading = Math.atan2(dx, dz);
    let diff = desiredHeading - this.car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steerInput = Math.max(-1, Math.min(1, diff * this.steerGain));

    // Corner sharpness from the track's tangent turning rate ahead.
    const sharp = this.track.cornerSharpnessAt(aheadFrac);
    const targetSpeed = this.pacer.targetSpeed(sharp, gap);

    // Throttle/brake toward target speed.
    const throttle = this.car.speed < targetSpeed ? 1 : 0;
    const brake = this.car.speed > targetSpeed * 1.08 ? 1 : 0;

    this.car.update(dt, {
      throttle,
      brake,
      steer: steerInput,
      handbrake: false,
      nitroRequested: false,
    });
    if ((frame & 4) === 0) {
      this.race.updateProgress(this.id, me);
    }
    return { steerInput, throttle, brake };
  }
}