import type { EraInfo } from '../eras/types';
import { useStore } from '../state/store';

export function EraPanel() {
  const currentEraKey = useStore(state => state.currentEra);
  const selectedEraKey = useStore(state => state.selectedEra);
  const transitioning = useStore(state => state.transitioning);
  const muted = useStore(state => state.muted);
  const volume = useStore(state => state.volume);
  const toggleMute = useStore(state => state.toggleMute);
  const setVolume = useStore(state => state.setVolume);

  const activeKey = selectedEraKey || currentEraKey;
  const nameMap: Record<string, string> = {
    '1945': 'Post-War America',
    '1965': 'Swinging Sixties',
    '1985': 'The Neon Age',
    '2005': 'Y2K Boom',
    '2025': 'Green Future',
    '2055': 'Megastructure Era',
  };
  const descMap: Record<string, string> = {
    '1945': 'The dawn of a new era after WWII. Simple brick buildings, vintage cars, and hopeful optimism.',
    '1965': 'The space age arrives. Neon signs, diners, convertibles, and a cultural revolution blooms.',
    '1985': 'Dusk falls on glass towers. Arcades, synthwave aesthetics, and the birth of the digital age.',
    '2005': 'Glass condos rise. Digital billboards, SUVs everywhere, and the internet changes everything.',
    '2025': 'LED facades, vertical gardens, electric vehicles, and sustainable urban living.',
    '2055': 'Supertall holographic megastructures. Flying vehicles, AI governance, and the city reaches for the stars.',
  };

  return (
    <div className="era-panel">
      <div className="era-info">
        <h2 className="era-year">{activeKey}</h2>
        <h3 className="era-name">{nameMap[activeKey] || activeKey}</h3>
        <p className="era-desc">{descMap[activeKey] || ''}</p>
      </div>

      {/* Audio controls */}
      <div className="audio-controls">
        <button
          className="mute-btn"
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={muted ? 'Unmute (M)' : 'Mute (M)'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="volume-slider"
          aria-label="Volume"
          title="Volume"
        />
      </div>
    </div>
  );
}
