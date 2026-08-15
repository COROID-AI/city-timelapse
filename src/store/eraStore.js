/// <reference types="node" />
/**
 * Era State & Transition Management Store
 *
 * Manages the current era state and transition lifecycle using Zustand.
 * Compatible with React Three Fiber's render loop — uses requestAnimationFrame
 * for smooth progress interpolation without blocking operations.
 *
 * Constraints:
 * - EraId union type must exactly match: '1945' | '1965' | '1985' | '2005' | '2025'
 * - All 5 eras must have complete VisualEraData in VISUAL_ERA_DATA record
 * - Must preserve existing audio-era type definitions from the manual implementation plan
 * - No blocking operations — uses requestAnimationFrame for timing
 */
import { create } from 'zustand';
import { VISUAL_ERA_DATA, } from '../eras';
import { SfxMixer } from '../audio/mixer';
// Module-level RAf ID to manage the animation loop
// This effectively acts as a "token" for the current transition animation
let rafId = null;
// Default transition duration: 1.5 seconds crossfade
const DEFAULT_TRANSITION_DURATION = 1500;
// Create the era store with Zustand
// Using explicit typing to avoid TS7006 implicit any errors
const eraStoreCreator = (set, get) => ({
    // Initial state
    currentEra: '1945',
    targetEra: null,
    isTransitioning: false,
    transitionProgress: 0,
    transitionDuration: DEFAULT_TRANSITION_DURATION,
    autoPlay: false,
    onTransitionComplete: null,
    // Action: setCurrentEra
    // Sets targetEra, starts transition timer via requestAnimationFrame,
    // updates currentEra when complete, fires onTransitionComplete callback
    setCurrentEra: (id) => {
        // Cancel any existing transition animation
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        set({
            targetEra: id,
            isTransitioning: true,
            transitionProgress: 0,
        });
        const duration = get().transitionDuration;
        // Trigger audio crossfade synchronously with the visual transition.
        // Autoplay policy is respected by SfxMixer: it won't actually start
        // until the first user gesture unlocks the AudioContext.
        SfxMixer.setEra(id, duration);
        const startTime = Date.now();
        const tick = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            set({ transitionProgress: progress });
            if (progress < 1) {
                rafId = requestAnimationFrame(tick);
            }
            else {
                // Transition complete — update currentEra, clear target, fire callback
                set({
                    currentEra: id,
                    targetEra: null,
                    isTransitioning: false,
                    transitionProgress: 1,
                });
                get().onTransitionComplete?.(id);
                rafId = null;
            }
        };
        rafId = requestAnimationFrame(tick);
    },
    // Action: setTransitionDuration
    setTransitionDuration: (duration) => {
        set({ transitionDuration: duration });
    },
    // Action: setAutoPlay
    setAutoPlay: (value) => {
        set({ autoPlay: value });
    },
    // Action: setOnTransitionComplete
    setOnTransitionComplete: (cb) => {
        set({ onTransitionComplete: cb });
    },
    // Action: resetTransition
    // Reset transition state (e.g., when navigating away or re-initializing)
    resetTransition: () => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        set({
            targetEra: null,
            isTransitioning: false,
            transitionProgress: 0,
        });
    },
    // Action: getEraData
    // Returns VisualEraData for the current era from VISUAL_ERA_DATA record
    getEraData: () => {
        // Use bracket access with EraId which is a union type literal
        // Cast to help TypeScript narrow the index type
        const data = VISUAL_ERA_DATA[get().currentEra];
        return data;
    },
});
// Export the Zustand store with proper type inference
export const useEraStore = create(eraStoreCreator);
