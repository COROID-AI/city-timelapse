import { useStore, ERAS } from '../state';

export default function EraInfo() {
  const { currentEra, targetEra, isTransitioning, transitionProgress } = useStore();
  const displayEra = isTransitioning ? targetEra : currentEra;
  const era = ERAS[displayEra];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '24px',
        zIndex: 100,
        color: '#fff',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          padding: '20px 28px',
          border: '1px solid rgba(255,255,255,0.1)',
          minWidth: '220px',
        }}
      >
        <div
          style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '1.8rem',
            fontWeight: 900,
            letterSpacing: '0.1em',
            color: era.color,
            textShadow: `0 0 20px ${era.color}66`,
          }}
        >
          {era.year}
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.7)',
            marginTop: '4px',
            letterSpacing: '0.05em',
          }}
        >
          {era.name}
        </div>
        {isTransitioning && (
          <div
            style={{
              marginTop: '12px',
              height: '2px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '1px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${transitionProgress * 100}%`,
                background: `linear-gradient(90deg, ${era.color}, ${ERAS[currentEra].color})`,
                borderRadius: '1px',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
