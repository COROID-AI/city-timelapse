
export type SfxStem =
  | 'mid2000s_pop_radio_loop'
  | 'cell_phone_ring_chorus'
  | 'traffic_hum_brakes'
  | 'bus_kneel_hiss'
  | 'distant_construction';

export interface EraAudio {
  readonly year: number;
  readonly sfxStems: readonly SfxStem[];
  readonly ambience: string;
}

export const era2005Audio: EraAudio = {
  year: 2005,
  ambience: 'Generic mid-2000s pop/radio loop with cell phone ring chorus, traffic hum with frequent brakes, bus kneel hiss,and distant construction from the condo build.',
  sfxStems: [
    'mid2000s_pop_radio_loop',
    'cell_phone_ring_chorus',
    'traffic_hum_brakes',
    'bus_kneel_hiss',
    'distant_construction',
  ],
};
