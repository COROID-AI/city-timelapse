import { useStore } from '../state/store';

export function ControlsBar() {
  const resetCamera = useStore(state => state.reset);
  const toggleMute = useStore(state => state.toggleMute);
  const muted = useStore(state => state.muted);

  return (
    <div className="controls-bar">
      <button onClick={resetCamera} title="Reset Camera (R)" aria-label="Reset camera">⟲</button>
      <button onClick={() => toggleMute()} title={muted ? 'Unmute (M)' : 'Mute (M)'} aria-label="Toggle mute">
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
