import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, getEffectiveEra } from './store';
import type { EraKey } from '../eras/types';

describe('state store', () => {
  beforeEach(() => {
    useStore.setState({
      currentEra: '2025' as EraKey,
      selectedEra: '2025' as EraKey | null,
      transitionProgress: 1,
      transitioning: false,
      previousEra: null,
      isPlaying: false,
      hoveredPOI: null,
      selectedPOI: null,
    });
  });

  it('starts at era 2025', () => {
    expect(useStore.getState().currentEra).toBe('2025');
  });

  it('selectEra triggers transition', () => {
    const store = useStore.getState();
    store.selectEra('1945');
    const s = useStore.getState();
    expect(s.selectedEra).toBe('1945');
    expect(s.transitioning).toBe(true);
    expect(s.transitionProgress).toBe(0);
  });

  it('nextEra cycles forward', () => {
    useStore.setState({ currentEra: '1945' as EraKey, transitioning: false, transitionProgress: 1 });
    useStore.getState().nextEra();
    expect(useStore.getState().selectedEra).toBe('1965');
  });

  it('prevEra cycles backward', () => {
    useStore.setState({ currentEra: '2055' as EraKey, transitioning: false, transitionProgress: 1 });
    useStore.getState().prevEra();
    expect(useStore.getState().selectedEra).toBe('2025');
  });

  it('togglePlay sets isPlaying', () => {
    expect(useStore.getState().isPlaying).toBe(false);
    useStore.getState().togglePlay();
    expect(useStore.getState().isPlaying).toBe(true);
  });

  it('setVolume clamps values', () => {
    useStore.getState().setVolume(-1);
    expect(useStore.getState().volume).toBe(0);
    useStore.getState().setVolume(2);
    expect(useStore.getState().volume).toBe(1);
    useStore.getState().setVolume(0.75);
    expect(useStore.getState().volume).toBe(0.75);
  });

  it('toggleMute flips muted state', () => {
    expect(useStore.getState().muted).toBe(false);
    useStore.getState().toggleMute();
    expect(useStore.getState().muted).toBe(true);
    useStore.getState().toggleMute();
    expect(useStore.getState().muted).toBe(false);
  });

  it('POI selection works', () => {
    expect(useStore.getState().hoveredPOI).toBeNull();
    useStore.getState().setHoveredPOI('building-1');
    expect(useStore.getState().hoveredPOI).toBe('building-1');
    useStore.getState().setSelectedPOI('building-2');
    expect(useStore.getState().selectedPOI).toBe('building-2');
  });

  it('reset restores defaults', () => {
    useStore.getState().selectEra('2055');
    useStore.getState().reset();
    const s = useStore.getState();
    expect(s.currentEra).toBe('2025');
    expect(s.transitioning).toBe(false);
    expect(s.isPlaying).toBe(false);
  });
});
