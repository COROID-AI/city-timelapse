import { useAudio } from '../store/audio';

/**
 * Mute toggle button.
 *
 * A single switch that mutes or unmutes all audio (ambient beds, traffic,
 * events, music and the transition whoosh) through the shared audio store,
 * which the mixer consumes via its master gain. Also serves as an initial user
 * gesture that unlocks the AudioContext (autoplay policy).
 */
export function MuteButton() {
  const muted = useAudio((s) => s.muted);
  const toggleMute = useAudio((s) => s.toggleMute);

  return (
    <button
      type="button"
      className="mute-button"
      aria-pressed={muted}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      title={muted ? 'Unmute sound' : 'Mute sound'}
      onClick={toggleMute}
    >
      <span className="mute-icon" aria-hidden="true">
        {muted ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3z" />
            <path d="M16 8l5 8M21 8l-5 8" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3z" />
            <path d="M16 8a5 5 0 010 8M18.5 5.5a9 9 0 010 13" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        )}
      </span>
      <span className="mute-label">{muted ? 'Sound off' : 'Sound on'}</span>
    </button>
  );
}