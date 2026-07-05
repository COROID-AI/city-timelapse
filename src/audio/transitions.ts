import { EraId, SfxEraData } from '../eras';

export type TransitionType = 'vinyl-scratch' | 'whoosh-sweep' | 'era-snap' | 'glass-chime';

export interface TransitionSfxParams {
  type: TransitionType;
  /** Base frequency used for tonal components */
  baseFreq: number;
  /** Noise amount for breathy components */
  noiseAmount: number;
}

export interface TransitionSfx {
  /** One-shot buffer */
  buffer: AudioBuffer;
  /** Optional envelope shaping */
  duration: number;
}

export interface TransitionSfxGenerateResult {
  /** Shared per-era transition seed buffer helpers */
  get: (from: EraId, to: EraId) => TransitionSfxParams;
}

function assertEraId(id: string): asserts id is EraId {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  if (!id || !['1945', '1965', '1985', '2005', '2025'].includes(id)) {
    throw new Error(`Unknown era id: ${id}`);
  }
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hashTo01(input: string): number {
  // Simple deterministic hash -> [0,1)
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // eslint-disable-next-line no-bitwise
  const u = h >>> 0;
  return (u % 100000) / 100000;
}

function paramsForFromTo(from: EraId, to: EraId, fromData: SfxEraData, toData: SfxEraData): TransitionSfxParams {
  // Unique-ish transitions for each era pair by picking a type bucket and using era tones.
  const key = `${from}->${to}`;
  const u = hashTo01(key);

  // Prefer a whoosh for adjacent eras; use more stylized types for bigger jumps.
  const fromIndex = ['1945', '1965', '1985', '2005', '2025'].indexOf(from);
  const toIndex = ['1945', '1965', '1985', '2005', '2025'].indexOf(to);
  const jump = Math.abs(toIndex - fromIndex);

  const baseFreq = mix(fromData.ambientTone, toData.ambientTone, 0.4 + u * 0.2);

  if (jump === 1) {
    return {
      type: u < 0.34 ? 'whoosh-sweep' : 'era-snap',
      baseFreq,
      noiseAmount: 0.25 + u * 0.15,
    };
  }

  if (jump === 2) {
    return {
      type: u < 0.5 ? 'vinyl-scratch' : 'whoosh-sweep',
      baseFreq: baseFreq * (0.85 + u * 0.3),
      noiseAmount: 0.35 + u * 0.2,
    };
  }

  // jump >= 3
  return {
    type: u < 0.45 ? 'glass-chime' : 'vinyl-scratch',
    baseFreq: baseFreq * (0.75 + u * 0.4),
    noiseAmount: 0.4 + u * 0.25,
  };
}

export function getTransitionSfxParams(from: EraId, to: EraId, eraData: Record<EraId, SfxEraData>): TransitionSfxParams {
  assertEraId(from);
  assertEraId(to);
  return paramsForFromTo(from, to, eraData[from], eraData[to]);
}
