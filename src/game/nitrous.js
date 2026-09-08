// Pure nitrous system: drift-charged, hold-decaying, activation consumes
// charge while boosting. No three.js import so node:test can verify it.

export class NitrousSystem {
  constructor(config) {
    this.config = config.nitrous;
    this.charge = 0;
    this.boosting = false;
  }

  /** Proportional charge: add absolute amount of slip, scaled by config. */
  addSlip(dt, slipMagnitude) {
    if (this.boosting) return; // boosting does not charge
    this.charge = Math.min(
      this.config.capacity,
      this.charge + this.config.chargePerSlip * slipMagnitude * dt,
    );
  }

  /**
   * Called every physics step. If a boost is requested and charge is above
   * threshold, consume it while boosting; otherwise decay the passive tank.
   * Returns the boost multiplier (1 when off) so the caller can apply it.
   */
  update(dt, requested) {
    const want = requested && this.charge >= this.config.canBoostThreshold;
    if (want) {
      this.boosting = true;
    } else if (!requested) {
      this.boosting = false;
    }
    // Once mid-boost, keep going until the tank runs dry.
    if (this.boosting) {
      this.charge -= this.config.consumePerSecond * dt;
      if (this.charge <= 0) {
        this.charge = 0;
        this.boosting = false;
      }
    } else {
      this.charge = Math.max(0, this.charge - this.config.chargeDecay * dt);
    }
    return this.boosting ? 1 : 0;
  }

  /** Charge fraction 0..1 for the HUD gauge. */
  get fraction() {
    return this.charge / this.config.capacity;
  }

  reset() {
    this.charge = 0;
    this.boosting = false;
  }
}