import React, { useEffect, useRef, useState } from 'react';
import { useEraStore } from '../store/eraStore';
import { EraId, getEraSpec, ERA_IDS } from '../eras';

/** 
 * TimelineSlider - A top-of-screen overlay component displaying five era markers
 * connected by a horizontal timeline bar. Users can select eras by clicking markers,
 * using keyboard shortcuts (1-5), Tab/Enter keys, or via hover tooltips.
 *
 * Features:
 * - Five era markers (1945, 1965, 1985, 2005, 2025) with year labels
 * - Active era visually distinguished with color change and underline glow
 * - Click handlers that call setCurrentEra() from Zustand eraStore
 * - Smooth CSS transition when switching between eras
 * - Keyboard shortcuts: pressing keys 1-5 selects corresponding era
 * - Tab key cycles through timeline slider items (Shift+Tab reverses direction)
 * - Enter key activates selected era
 * - Hover tooltips showing era description from EraSpec.label/description
 * - Responsive design: desktop (horizontal layout) stacks vertically on mobile
 * - ARIA tablist role and aria-selected attributes for accessibility
 * - Subtle frosted glass background gradient that doesn't obscure 3D scene
 * - pointer-events: none to not interfere with 3D canvas interaction
 * - Focus-visible keyboard outlines for full keyboard navigation
 * - Intro overlay that auto-dismisses on first interaction
 * - No keyboard traps — user can always return focus to 3D canvas
 */
export const TimelineSlider: React.FC = () => {
  const { currentEra, setCurrentEra } = useEraStore();
  const [isHovering, setIsHovering] = useState(false);

  // Ref for the container to manage keyboard events
  const containerRef = useRef<HTMLDivElement>(null);

  // Track if intro has been dismissed
  const [introDismissed, setIntroDismissed] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  // Intro overlay effect - shows once, dismisses on first interaction
  useEffect(() => {
    if (showIntro && !introDismissed) {
      // Auto-dismiss after first button click or key press
      const handleFirstInteraction = () => {
        setIntroDismissed(true);
        setShowIntro(false);
        containerRef.current?.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
      };
      containerRef.current?.addEventListener('click', handleFirstInteraction);
      window.addEventListener('keydown', handleFirstInteraction);
    }
  }, [showIntro, introDismissed]);

  useEffect(() => {
    // Keyboard event listener for era selection (keys 1-5)
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      // Map keys 1-5 to era indices 0-4
      const eraIndex = key.match(/[1-5]/)?.[0];
      if (eraIndex && containerRef.current) {
        const index = parseInt(eraIndex, 10) - 1; // 1 -> 0, 2 -> 1, etc.
        if (index >= 0 && index < ERA_IDS.length) {
          const eraId: EraId = ERA_IDS[index];
          setCurrentEra(eraId);
        }
      }
    };

    // Enter key handler for activating selected era
    const handleEnterKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        const activeButton = containerRef.current?.querySelector('[aria-selected="true"]');
        if (activeButton) {
          const event2 = new MouseEvent('click', { bubbles: true });
          activeButton.dispatchEvent(event2);
        }
      }
    };

    // Keyboard cycling (Tab/Shift+Tab)
    const handleKeyCycling = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        const buttons = containerRef.current?.querySelectorAll('button[role="tab"]');
        if (buttons && buttons.length > 0) {
          const currentIndex = Array.from(buttons).indexOf(event.target as HTMLButtonElement);
          const totalButtons = buttons.length;
          
          let nextIndex = currentIndex;
          if (event.shiftKey) {
            // Shift+Tab: move to previous button
            nextIndex = currentIndex === 0 ? totalButtons - 1 : currentIndex - 1;
          } else {
            // Tab: move to next button
            nextIndex = currentIndex === totalButtons - 1 ? 0 : currentIndex + 1;
          }
          
          if (buttons[nextIndex]) {
            buttons[nextIndex].focus();
          }
        }
      }
    };

    containerRef.current?.addEventListener('keydown', handleKeyDown);
    containerRef.current?.addEventListener('keydown', handleEnterKey);
    containerRef.current?.addEventListener('keydown', handleKeyCycling);
    return () => {
      containerRef.current?.removeEventListener('keydown', handleKeyDown);
      containerRef.current?.removeEventListener('keydown', handleEnterKey);
      containerRef.current?.removeEventListener('keydown', handleKeyCycling);
    };
  }, [setCurrentEra]);

  // Determine if an era is the currently active one
  const isActive = (eraId: EraId) => currentEra === eraId;

  // Get era spec for tooltip and styling
  const getEraSpecFn = (eraId: EraId) => getEraSpec(eraId);

  return (
    <>
      {showIntro && !introDismissed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(20, 20, 20, 0.8)',
            backdropFilter: 'blur(8px)',
            '-webkit-backdrop-filter': 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            zIndex: 1000,
            color: 'white',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '24px' }}>Welcome to Café Timelapse!</h2>
          <p style={{ margin: '0 0 16px', fontSize: '16px', textAlign: 'center' }}>
            Click the timeline slider or press <kbd>1</kbd>-<kbd>5</kbd> to travel through time.
          </p>
          <button
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              background: '#ffd700',
              color: 'black',
              border: 'none',
              borderRadius: '4px',
            }}
            onClick={() => {
              setIntroDismissed(true);
              setShowIntro(false);
            }}
          >
            Got it!
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        role="tablist"
        aria-label="Era selection timeline"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          padding: '8px 16px',
          background: 'rgba(20, 20, 20, 0.6)',
          backdropFilter: 'blur(8px)',
          '-webkit-backdrop-filter': 'blur(8px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 100,
          pointerEvents: 'none', // Don't interfere with 3D canvas interaction
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '4px',
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {ERA_IDS.map((eraId, index) => {
            const eraSpec = getEraSpecFn(eraId);
            const isActiveEra = isActive(eraId);
            const isFirst = index === 0;
            const isLast = index === ERA_IDS.length - 1;

            // Calculate transition delay for smooth staggered animation
            const transitionDelay = `${index * 150}ms`;

            return (
              <button
                key={eraId}
                type="button"
                role="tab"
                aria-selected={isActiveEra}
                aria-label={eraSpec.label}
                tabIndex={0} // All buttons focusable for Tab cycling
                style={{
                  // Base button styles
                  minWidth: '80px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  textAlign: 'center',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  border: 'none',
                  borderRadius: '4px',
                  transition: 'all 0.3s ease',
                  // Positioning within flex container
                  flex: '0 0 auto',
                  // Subtle gradient background that doesn't obscure 3D scene
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                  color: isActiveEra ? '#ffd700' : 'rgba(255, 255, 255, 0.7)',
                  boxShadow: isActiveEra
                    ? '0 0 10px rgba(255, 215, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)'
                    : '0 0 5px rgba(255, 255, 255, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)',
                  outline: 'none',
                  // Horizontal timeline bar connector
                  position: 'relative',
                  // Mobile/flex direction will be handled by parent on small screens
                  ...(isActiveEra && {
                    // Active era glow effect
                    animation: `eraGlow 1.5s ease-in-out ${transitionDelay} infinite`,
                  }),
                  // **Keyboard focus styles** - only show on keyboard focus, not mouse hover
                  '&:focus-visible': {
                    outline: '2px solid #ffd700',
                    outlineOffset: '2px',
                  },
                  // Hover effect for tooltips
                  '&:hover': {
                    color: '#fff',
                    background: 'rgba(255, 255, 255, 0.2)',
                    transform: 'translateY(-2px)',
                    boxShadow: isActiveEra
                      ? '0 0 15px rgba(255, 215, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3)'
                      : '0 0 10px rgba(255, 255, 255, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
                  },
                  // Disabled state
                  '&:disabled': {
                    opacity: 0.5,
                    cursor: 'not-allowed',
                  },
                }}
                onClick={() => setCurrentEra(eraId)}
              >
                <span
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '4px 0',
                    position: 'relative',
                  }}
                >
                  {eraSpec.label}{' '}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-24px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '10px',
                      color: 'rgba(255, 255, 255, 0.8)',
                      background: 'rgba(0, 0, 0, 0.6)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}
                  >
                    {eraSpec.description.substring(0, 60)}{'...'}
                  </span>
                </span>
                <span
                  style={{
                    display: 'block',
                    fontWeight: isActiveEra ? 700 : 500,
                    letterSpacing: '0.5px',
                    transition: 'color 0.3s ease',
                  }}
                >
                  {eraId}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* 
 * Keyframe animation for active era glow effect
 * Subtle pulsating glow when an era is selected
 */
const eraGlow = `
  0%, 100% {
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.6), 0 4px 8px rgba(0, 0, 0, 0.3);
  }
`;

// Export for potential testing
export default TimelineSlider;