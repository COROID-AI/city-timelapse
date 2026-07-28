import { useStore, ERAS, type EraIndex } from '../state';

export default function TimelineSlider() {
  const { currentEra, targetEra, isTransitioning, startTransition } = useStore();
  const displayEra = isTransitioning ? targetEra : currentEra;

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        borderRadius: '40px',
        padding: '10px 20px',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {ERAS.map((era, i) => {
        const idx = i as EraIndex;
        const isActive = idx === displayEra;
        return (
          <button
            key={era.year}
            onClick={() => startTransition(idx)}
            style={{
              background: isActive
                ? `linear-gradient(135deg, ${era.color}, ${era.color}dd)`
                : 'transparent',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
              border: isActive
                ? `2px solid ${era.color}`
                : '2px solid rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '6px 14px',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: '0.7rem',
              fontWeight: isActive ? 700 : 400,
              cursor: 'pointer',
              transition: 'all 0.4s ease',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              transform: isActive ? 'scale(1.1)' : 'scale(1)',
              boxShadow: isActive ? `0 0 20px ${era.color}44` : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)';
                (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.8)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
                (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
              }
            }}
          >
            {era.year}
          </button>
        );
      })}
    </div>
  );
}
