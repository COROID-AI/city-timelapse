interface EraIndicatorProps {
  era: number
}

const ERA_INFO: Record<number, { title: string; description: string }> = {
  1945: {
    title: 'Post-War Era',
    description: 'Reconstruction and renewal rebuild the city with sturdy brick buildings and classic American design.'
  },
  1965: {
    title: 'Mid-Century Boom',
    description: 'Suburban growth and optimism bring modernist architecture and American muscle cars.'
  },
  1985: {
    title: 'Urban Revival',
    description: 'Gentrification emerges with glass storefronts, early computers, and evolving street culture.'
  },
  2005: {
    title: 'Digital Age',
    description: 'LED signs, smartphones, hybrid vehicles, and contemporary urban planning transform the streets.'
  },
  2025: {
    title: 'Sustainable Future',
    description: 'Electric vehicles, smart buildings, and renewable energy define modern city life.'
  },
  2055: {
    title: 'Neo-Futurism',
    description: 'Hovering vehicles, holographic displays, vertical gardens, and bio-integrated architecture.'
  }
}

export function EraIndicator({ era }: EraIndicatorProps) {
  const info = ERA_INFO[era]

  return (
    <div
      style={{
        position: 'absolute',
        top: '100px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '16px',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        maxWidth: '300px',
      }}
      aria-live="polite"
    >
      <h2 style={{ margin: '0 0 8px 0', fontSize: '1.4rem' }}>
        {info?.title || era}
      </h2>
      <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
        {info?.description}
      </p>
      
      <div
        style={{
          marginTop: '12px',
          padding: '8px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '4px',
          fontSize: '0.8rem',
        }}
      >
        Use arrow keys or press 1-6 to navigate eras
      </div>
    </div>
  )
}