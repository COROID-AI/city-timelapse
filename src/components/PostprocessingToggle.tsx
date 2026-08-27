import { useSettings } from '../store/settings';

/**
 * Postprocessing toggle button.
 *
 * Lets low-end devices disable the bloom / vignette / tone-mapping chain for a
 * cheaper frame. Wired to the settings store, which the postprocessing
 * compositor reads so the whole effect chain unmounts when disabled.
 */
export function PostprocessingToggle() {
  const enabled = useSettings((s) => s.postprocessingEnabled);
  const toggle = useSettings((s) => s.togglePostprocessing);

  return (
    <button
      type="button"
      className={
        enabled ? 'fx-toggle active' : 'fx-toggle'
      }
      aria-pressed={enabled}
      aria-label="Toggle visual effects (bloom, vignette, tone mapping)"
      title="Toggle visual effects for performance"
      onClick={toggle}
    >
      <span className="fx-toggle-icon" aria-hidden="true">
        ✦
      </span>
      <span className="fx-toggle-label">Effects</span>
    </button>
  );
}