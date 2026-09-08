// Central tunables for the neon street racer.
// This module is pure data (no three.js import) so node:test can require it.

export const CONFIG = {
  race: {
    laps: 3,
    aiCount: 4,
    countdown: 3.2, // seconds of pre-race countdown
  },

  // Arced city circuit control points (XZ ground plane). Closed loop.
  track: {
    points: [
      [0, 0, -90],
      [-40, 0, -20],
      [-10, 0, 40],
      [35, 0, 30],
      [55, 0, -25],
      [25, 0, -80],
    ],
    halfWidth: 11, // road half width in world units
    reflectTexture: 1024, // Reflector mirror texture size
    laneMarkingGap: 14,
  },

  car: {
    accel: 46,
    reverseAccel: 24,
    topSpeed: 60, // forward speed cap (units/s)
    reverseTopSpeed: 22,
    brakeDecel: 60,
    grip: 3.2, // lateral slip decay (drift/wall clamping strength)
    steerRate: 2.6, // radians per second of heading
    steerSpeedFactor: 1.35, // additional steering authority at high speed
    handbrakeSlip: 0.18, // extra lateral slide for handbrake drifts
    wheelRadius: 0.38,
    drag: 0.05,
    idleFriction: 0.9, // how quickly speed decays with no input
  },

  nitrous: {
    capacity: 100,
    chargePerSlip: 8.0, // charge gained per unit of accumulated lateral slip
    chargeDecay: 4.0, // passive hold/decay per second when not drifting
    consumePerSecond: 45,
    canBoostThreshold: 8, // minimum charge to start a boost
    boostAccelMult: 2.2,
    boostTopSpeedMult: 1.55,
    boostFov: 92, // wide-angle FOV while boosting
    exhaustFlameActive: 1.0,
  },

  camera: {
    followDist: 8.5,
    followHeight: 3.6,
    lookAhead: 6,
    fovBase: 62,
    fovSpeedExtra: 22, // extra FOV at top speed (speed01 -> this)
    lerp: 0.09,
    shakeAmp: 0.05,
    shakeBoostMult: 2.2,
  },

  postfx: {
    bloomStrength: 1.15,
    bloomRadius: 0.62,
    bloomThreshold: 0.22,
    afterimageMin: 0.55, // motion blur damp at standstill
    afterimageMax: 0.86, // motion blur damp at top speed
    pixelRatioCap: 1.75,
  },

  ai: {
    skills: [0.9, 0.995, 1.035, 0.96],
    baseSpeed: 52,
    minSpeed: 26,
    cornerSharpnessScale: 22,
    rubberBandGap: 60, // positive gap -> speed up; negative -> ease off
    rubberBandFactor: 0.12,
    lateralOffsets: [-4.5, 5, 0, 3.5],
    lookahead: 9,
    steerGain: 4.0,
    routeStartFrac: [0.06, 0.18, 0.3, 0.42], // stagger start lines so AI split up
  },

  neonPalette: [
    { color: 0xff2d92, emissiveIntensity: 2.2 }, // hot pink
    { color: 0x00e5ff, emissiveIntensity: 2.0 }, // cyan
    { color: 0x7c4dff, emissiveIntensity: 2.2 }, // violet
    { color: 0x27ff9a, emissiveIntensity: 2.0 }, // green
    { color: 0xffc400, emissiveIntensity: 2.2 }, // amber
    { color: 0xff6b1a, emissiveIntensity: 2.1 }, // orange
  ],
};

// Export a convenience accessor too.
export const config = CONFIG;