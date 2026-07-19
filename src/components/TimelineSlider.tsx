import { useEffect } from 'react'

const ERAS = [1945, 1965, 1985, 2005, 2025, 2055] as const
type Era = typeof ERAS[number]

interface TimelineSliderProps {
  eras: readonly number[]
  currentEra: Era
  onEraChange: (era: Era) => void
  isTransitioning: boolean
}

export function TimelineSlider({ eras, currentEra, onEraChange, isTransitioning }: TimelineSliderProps) {
  const currentIndex = eras.indexOf(currentEra)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      
      const eraKeys: Record<string, number> = {
        '1': 1945, '2': 1965, '3': 1985, '4': 2005, '5': 2025, '6': 2055
      }
      
      if (e.key in eraKeys && !isTransitioning) {
        onEraChange(eraKeys[e.key] as Era)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentEra, onEraChange, isTransitioning, eras])

  const handleEraClick = (era: number) => {
    if (!isTransitioning) {
      onEraChange(era as Era)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '16px 24px',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
      role="slider"
      aria-label="Timeline era selector"
      aria-valuenow={currentEra}
      aria-valuemin={Math.min(...eras)}
      aria-valuemax={Math.max(...eras)}
      aria-valuetext={`${currentEra} era`}
    >
      {eras.map((era, index) => (
        <button
          key={era}
          onClick={() => handleEraClick(era)}
          disabled={isTransitioning}
          aria-label={`Jump to ${era} era`}
          aria-current={currentEra === era ? 'true' : 'false'}
          title={`${era} (${index + 1}/${eras.length})`}
          style={{
            padding: '12px 20px',
            background: currentEra === era 
              ? `var(--era-${era})` 
              : 'rgba(255, 255, 255, 0.1)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: isTransitioning ? 'default' : 'pointer',
            fontWeight: currentEra === era ? 'bold' : 'normal',
            opacity: isTransitioning ? 0.6 : 1,
            transition: 'all 0.2s ease',
            minWidth: '70px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {era}
          {isTransitioning && currentEra !== era && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: '2px',
                background: 'linear-gradient(90deg, var(--era-2025), var(--era-2055))',
                animation: 'pulse 1s infinite',
              }}
            />
          )}
        </button>
      ))}
      
      <div
        style={{
          position: 'absolute',
          bottom: '-8px',
          left: '16px',
          right: '16px',
          height: '4px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(currentIndex / (eras.length - 1)) * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, var(--era-1945), var(--era-2055))`,
            transition: isTransitioning ? 'none' : 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}