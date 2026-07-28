import { describe, test, expect, beforeEach } from 'vitest';
import { useEraStore, ERAS, Era } from '../state';

describe('Era Store', () => {
  beforeEach(() => {
    // Reset to initial state before each test
    useEraStore.setState({ selectedEra: 0 });
  });

  test('initial state is 1945 (era index 0)', () => {
    const state = useEraStore.getState();
    expect(state.selectedEra).toBe(0);
    expect(ERAS[state.selectedEra].year).toBe(1945);
  });

  test('setSelectedEra updates the selected era', () => {
    const { setSelectedEra } = useEraStore.getState();
    setSelectedEra(3 as Era);
    const state = useEraStore.getState();
    expect(state.selectedEra).toBe(3);
    expect(ERAS[state.selectedEra].year).toBe(2005);
  });

  test('all six eras are defined with correct years', () => {
    expect(ERAS).toHaveLength(6);
    expect(ERAS.map((e) => e.year)).toEqual([1945, 1965, 1985, 2005, 2025, 2055]);
  });

  test('each era has a unique index', () => {
    const indices = ERAS.map((e) => e.index);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('each era has a label matching its year', () => {
    ERAS.forEach((era) => {
      expect(era.label).toBe(String(era.year));
    });
  });

  test('each era has a color', () => {
    ERAS.forEach((era) => {
      expect(era.color).toBeTruthy();
      expect(era.color).toMatch(/^#([0-9A-Fa-f]{3}){1,2}$/);
    });
  });
});
