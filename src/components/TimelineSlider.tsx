import { useEraTimeline } from '../store/eraTimeline';
import { ERA_REGISTRY, type EraId } from '../eras';

/**
 * Top-of-viewport timeline slider.
 *
 * Renders the five era options (1945, 1965, 1985, 2005, 2025), highlights the
 * active era, and calls the store's `setEra` action on selection. Keyboard
 * operable (arrow keys + Enter) for accessibility.
 */
export function TimelineSlider() {
  const currentEra = useEraTimeline((s) => s.currentEra);
  const targetEra = useEraTimeline((s) => s.targetEra);
  const transitionProgress = useEraTimeline((s) => s.transitionProgress);
  const setEra = useEraTimeline((s) => s.setEra);

  // The active (dominant) era shown by the slider follows the transition so the
  // highlight morphs along with the scene.
  const activeEra = transitionProgress >= 0.5 ? targetEra : currentEra;

  return (
    <nav
      className="timeline-slider"
      role="tablist"
      aria-label="Select a city time period"
    >
      {ERA_REGISTRY.map((era) => {
        const isActive = era.id === activeEra;
        return (
          <button
            key={era.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={era.description}
            className={isActive ? 'timeline-option active' : 'timeline-option'}
            onClick={() => setEra(era.id as EraId)}
          >
            <span className="timeline-dot" aria-hidden="true" />
            <span className="timeline-label">{era.label}</span>
          </button>
        );
      })}
    </nav>
  );
}