interface LoadingScreenProps {
  isVisible: boolean
  hasError: boolean
}

export function LoadingScreen({ isVisible, hasError }: LoadingScreenProps) {
  if (!isVisible) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, #050505, #151520)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      transition: 'opacity 0.5s ease'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        maxWidth: '400px'
      }}>
        {hasError ? (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#ff4444' }}>
              ⚠️
            </div>
            <h2 style={{ color: '#ff4444', marginBottom: '1rem' }}>
              Failed to Load Scene
            </h2>
            <p style={{ color: '#888', lineHeight: 1.6 }}>
              There was an error loading the city scene. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '2rem',
                padding: '0.75rem 2rem',
                background: 'linear-gradient(180deg, #4a90d9, #2d6bb5)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              Reload
            </button>
          </>
        ) : (
          <>
            <div style={{
              width: '60px',
              height: '60px',
              border: '3px solid #333',
              borderTopColor: '#4a90d9',
              borderRadius: '50%',
              margin: '0 auto 1.5rem',
              animation: 'spin 1s linear infinite'
            }} />
            <h2 style={{ marginBottom: '1rem', color: '#fff' }}>
              Loading City Scene
            </h2>
            <p style={{ color: '#888' }}>
              Preparing the timelapse experience...
            </p>
          </>
        )}
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
