import { AmbientLight, DirectionalLight, Scene } from 'three';

/**
 * Lighting: a controllable light rig for the scene.
 *
 * Exposes a sun/sky directional light whose color and intensity shift with a
 * time-of-day preview value (0 = night, 0.5 = noon, 1 = dusk). Ambient light
 * provides base fill.
 */
export interface LightRig {
  /** The primary sun directional light. */
  readonly sun: DirectionalLight;
  /** Ambient fill light. */
  readonly ambient: AmbientLight;
  /**
   * Set time-of-day preview in [0, 1] (0 = night, 0.5 = noon, 1 = dusk).
   * Updates sun color/intensity and ambient fill.
   */
  setTimeOfDay(t: number): void;
  /** Current time-of-day in [0, 1]. */
  readonly timeOfDay: number;
}

const NIGHT_COLOR = [0.08, 0.1, 0.18] as const;
const DAY_COLOR = [1.0, 0.95, 0.85] as const;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function createLightRig(scene: Scene): LightRig {
  const sun = new DirectionalLight();
  sun.position.set(80, 120, 40);
  sun.target.position.set(0, 0, 0);

  const ambient = new AmbientLight();
  ambient.intensity = 0.35;

  scene.add(sun, ambient);

  const rig: LightRig = {
    sun,
    ambient,
    timeOfDay: 0.5,
    setTimeOfDay(t: number) {
      const clamped = Math.max(0, Math.min(1, t));
      (rig as { timeOfDay: number }).timeOfDay = clamped;
      // 0 at noon, 1 at night/dusk extremes.
      const towardNight = Math.min(1, Math.abs(clamped - 0.5) * 2);
      const r = lerp(DAY_COLOR[0], NIGHT_COLOR[0], towardNight);
      const g = lerp(DAY_COLOR[1], NIGHT_COLOR[1], towardNight);
      const b = lerp(DAY_COLOR[2], NIGHT_COLOR[2], towardNight);
      sun.color.setRGB(r, g, b);
      sun.intensity = lerp(0.15, 1.2, 1 - towardNight);
      ambient.intensity = lerp(0.12, 0.4, 1 - towardNight);
    },
  };
  rig.setTimeOfDay(0.5);
  return rig;
}