import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { easeInOutCubic } from '../lib/math';
import { useStore } from '../state/store';

interface TransitionManagerProps {
  children: React.ReactNode;
}

export function TransitionManager({ children }: TransitionManagerProps) {
  const startTime = useRef<number>(0);
  const duration = 2.5; // seconds for full transition
  const store = useStore();

  useEffect(() => {
    if (store.transitioning) {
      startTime.current = performance.now();
    }
  }, [store.selectedEra, store.transitioning]);

  useFrame(() => {
    if (!store.transitioning || !store.selectedEra) return;

    const elapsed = (performance.now() - startTime.current) / 1000;
    const t = Math.min(elapsed / duration, 1);
    const easedT = easeInOutCubic(t);

    store.setTransitioning(t < 1);
  });

  return <>{children}</>;
}
