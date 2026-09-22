/**
 * Public surface of the staged era transition director.
 *
 * This barrel is the only module other owners import. It exports four things:
 *
 * 1. **The contract** — {@link TransitionDirector} and the ports it consumes
 *    (`TransitionLayerAdapter`, `TransitionAudioPort`, `TransitionCameraPort`,
 *    `TransitionMotionPort`, `TransitionClock`), plus the schedule and frame
 *    types. Nothing here imports a layer, the pipeline, the engine or the UI.
 * 2. **The director** — {@link createTransitionDirector}, the component that turns
 *    one era selection into a staged, interruptible, in-place transformation.
 * 3. **The helpers** — {@link ease}, {@link crossfadeWeights},
 *    {@link crossfadeValue}, {@link resumeProgress}, {@link resolveDominantEra}
 *    and the schedule table (`DEFAULT_TRANSITION_SCHEDULE`,
 *    {@link createTransitionSchedule}, {@link resolveSchedule}).
 * 4. **The adapters and the React binding** — {@link createSceneLayerAdapters}
 *    (the real layer wiring), {@link createAudioEnginePort},
 *    {@link createNavigationCameraPort}, {@link createUIControlsMotionPort}, and
 *    {@link useTransitionDirector} for React hosts.
 *
 * Integration recipe (scene integration, phase 5)
 * ----------------------------------------------
 * ```ts
 * // 1. Build the adapters once, over the real block and pipeline.
 * const wiring = await createSceneLayerAdapters({ layout, atmosphere: pipeline })
 * const director = createTransitionDirector({
 *   store: useEraStore,
 *   layers: wiring.adapters,
 *   audio: createAudioEnginePort(audioEngine),
 *   camera: createNavigationCameraPort(pipeline.controls),
 *   motion: createUIControlsMotionPort(useUIControlsStore),
 * })
 * // 2. Tick it from the pipeline's own frame hook.
 * pipeline.onFrame(() => director.tick())
 * // 3. Render `snapshot.progress` / `snapshot.active` in the overlay; the era
 * //    store is written by the director (setTransition → setProgress →
 * //    completeTransition), and `snapshot.lastCompletion` is the signal that
 * //    clears the indicator.
 * ```
 *
 * Stages without a shipped barrel (`buildings`, `pedestrians` in this revision,
 * see {@link PENDING_LAYER_STAGES}) are scheduled and reported as
 * `snapshot.pendingStages`; wiring one later is a single `bindLayerAdapter` entry
 * in {@link createSceneLayerAdapters}.
 *
 * Browser proof of the director alone lives in `src/transition/harness.html`,
 * which mounts the director over the era store with stub adapters, a stub camera
 * and a stub progress indicator and publishes its state on
 * `window.__transitionHarness`.
 */

export * from './types'
export * from './easing'
export * from './schedule'
export * from './director'
export * from './adapters'
export * from './useTransitionDirector'
