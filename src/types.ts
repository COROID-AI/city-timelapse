export type EraYear = 1945 | 1965 | 1985 | 2005 | 2025 | 2055;

export interface EraContextType {
  year: EraYear;
  setYear: (year: EraYear) => void;
}

export interface AudioContextType {
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  oscillatorsRef: React.MutableRefObject<Map<string, OscillatorNode> | null>;
  gainNodeRef: React.MutableRefObject<GainNode | null>;
  isMuted: boolean;
  toggleMute: () => void;
}

export interface SfxManagerRef {
  getCurrentContext: () => AudioContext | null;
  start: (audioContext: AudioContext, era: EraYear, outputGain: GainNode) => void;
  stop: () => void;
  transition: (audioContext: AudioContext, from: EraYear, to: EraYear, durationSeconds: number) => void;
}
