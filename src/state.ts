import { create } from 'zustand';

export type Era = 0 | 1 | 2 | 3 | 4 | 5;

export interface EraDef {
  index: Era;
  year: number;
  label: string;
  color: string;
}

export const ERAS: EraDef[] = [
  { index: 0, year: 1945, label: '1945', color: '#8B4513' },
  { index: 1, year: 1965, label: '1965', color: '#FFB6C1' },
  { index: 2, year: 1985, label: '1985', color: '#000080' },
  { index: 3, year: 2005, label: '2005', color: '#4682B4' },
  { index: 4, year: 2025, label: '2025', color: '#32CD32' },
  { index: 5, year: 2055, label: '2055', color: '#00FFFF' },
];

interface EraState {
  selectedEra: Era;
  setSelectedEra: (era: Era) => void;
}

export const useEraStore = create<EraState>((set) => ({
  selectedEra: 0,
  setSelectedEra: (era: Era) => set({ selectedEra: era }),
}));

export const useEra = useEraStore;
export default useEraStore;
