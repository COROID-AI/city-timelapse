import { ERA_ORDER } from '../eras/types';
import { useStore } from '../state/store';
import { playClick } from '../audio/sfx';

export function Timeline() {
  const currentEra = useStore(state => state.currentEra);
  const selectedEra = useStore(state => state.selectedEra);
  const transitioning = useStore(state => state.transitioning);
  const isPlaying = useStore(state => state.isPlaying);
  const selectEra = useStore(state => state.selectEra);
  const togglePlay = useStore(state => state.togglePlay);

  return (
    <div className="timeline-container" role="slider" aria-label="Time period timeline"
      aria-valuenow={Number(selectedEra ?? currentEra)} aria-valuemin={1945} aria-valuemax={2055}
      aria-valuetext={`Selected era: ${selectedEra || currentEra}`}>
      <div className="timeline-track">
        {ERA_ORDER.map(year => {
          const isActive = (selectedEra ?? currentEra) === year;
          const isPast = Number(year) <= Number(currentEra);
          return (
            <button
              key={year}
              className={`timeline-stop ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
              onClick={() => { playClick(); selectEra(year); }}
              aria-pressed={isActive}
              title={`${year}: ${getEraName(year)}`}
            >
              <span className="stop-year">{year}</span>
              {isActive && <span className="stop-dot" />}
            </button>
          );
        })}
      </div>

      {/* Play/Pause button */}
      <button
        className="play-btn"
        onClick={() => { playClick(); togglePlay(); }}
        aria-label={isPlaying ? 'Pause timelapse' : 'Play timelapse'}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
    </div>
  );
}

function getEraName(year: string): string {
  const names: Record<string, string> = {
    '1945': 'Post-War America',
    '1965': 'Swinging Sixties',
    '1985': 'The Neon Age',
    '2005': 'Y2K Boom',
    '2025': 'Green Future',
    '2055': 'Megastructure Era',
  };
  return names[year] || year;
}
