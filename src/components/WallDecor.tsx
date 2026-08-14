import React, { ReactElement, useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useStore as useEraStore } from '../store/eraStore';
import { useThree } from '@react-three/fiber';
import { EraId } from '../eras';

// Type for poster ad configuration
interface PosterAd {
  text: string;
  position: 'left' | 'center' | 'right';
}

// Type for era-specific wall decoration config
interface EraWallDecor {
  backgroundStyle: string;
  posterAds: PosterAd[];
  decorativeElements: string[];
  canvasTextureDescriptions: string[];
}

const ERA_DECOR: Record<EraId, EraWallDecor> = {
  '1945': {
    backgroundStyle: 'vintage-parchment',
    posterAds: [
      { text: 'Join the Army', position: 'left' },
      { text: 'Buy War Bonds', position: 'center' },
      { text: 'Coca-Cola', position: 'right' },
    ],
    decorativeElements: [
      'vinyl-record',
      'victory-garden',
      'rosie-the-riveter',
      'war-bond-notice',
      'black-white-photo',
    ],
    canvasTextureDescriptions: [
      'canvas-texture-grunge-white',
      'canvas-texture-parchment-old',
    ],
  },
  '1965': {
    backgroundStyle: 'psychedelic-swirl',
    posterAds: [
      { text: 'The Beatles', position: 'left' },
      { text: 'Pepsi', position: 'center' },
      { text: 'Floyd Record Store', position: 'right' },
    ],
    decorativeElements: [
      'beatles-poster',
      'psychedelic-flyer',
      'civil-rights-imagery',
      'soda-ad',
      'mid-century-abstract',
    ],
    canvasTextureDescriptions: [
      'canvas-texture-psychedelic',
      'canvas-texture-pop-art',
    ],
  },
  '1985': {
    backgroundStyle: 'neon-grid',
    posterAds: [
      { text: 'Arcade Games', position: 'left' },
      { text: 'Walkman', position: 'center' },
      { text: 'New Release Movies', position: 'right' },
    ],
    decorativeElements: [
      'mtv-logo',
      'synthwave-poster',
      'reagan-poster',
      'arcade-game-ad',
      'neon-band-poster',
    ],
    canvasTextureDescriptions: [
      'canvas-texture-neon',
      'canvas-texture-grid',
    ],
  },
  '2005': {
    backgroundStyle: 'digital-grid',
    posterAds: [
      { text: 'WiFi Available', position: 'left' },
      { text: 'iTunes Music', position: 'center' },
      { text: 'Blog This', position: 'right' },
    ],
    decorativeElements: [
      'indie-gig-poster',
      'starbucks-branding',
      'smartphone-ad',
      'harry-potter-decor',
      'polaroid-wall',
    ],
    canvasTextureDescriptions: [
      'canvas-texture-digital',
      'canvas-texture-grid-paper',
    ],
  },
  '2025': {
    backgroundStyle: 'minimalist-white',
    posterAds: [
      { text: 'AR Experience', position: 'left' },
      { text: 'AI Order', position: 'center' },
      { text: 'Carbon Neutral', position: 'right' },
    ],
    decorativeElements: [
      'minimalist-art-print',
      'eco-messaging',
      'coffee-origin-map',
      'instagram-aesthetic',
      'digital-screen',
      'qr-code-art',
    ],
    canvasTextureDescriptions: [
      'canvas-texture-smooth-white',
      'canvas-texture-minimalist',
    ],
  },
};

export const WallDecor: React.FC = () => {
  const { currentEra } = useEraStore(state => state.currentEra);
  const { canvas } = useThree();

  const decor = ERA_DECOR[currentEra] || ERA_DECOR['1945'];

  // Compute styles for decorative elements based on era
  const elementStyles: Record<string, React.CSSProperties> = {
    // 1945 elements
    vinyl_record: {
      width: '2.5rem',
      height: '2.5rem',
      background:
        currentEra === '1945'
          ? 'url("/textures/vinyl.png")'
          : 'var(--accent-color)',
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      margin: '0.3rem',
    },
    victory_garden: {
      width: '2rem',
      height: '2rem',
      background: currentEra === '1945' ? 'var(--accent-color)' : '#33aaff',
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      margin: '0.3rem',
    },
    rosie_the_riveter: {
      width: '3rem',
      height: '3rem',
      background: currentEra === '1945' ? 'var(--accent-color)' : '#33aaff',
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      margin: '0.3rem',
    },
    war_bond_notice: {
      width: '2.5rem',
      height: '2.5rem',
      background: currentEra === '1945' ? 'var(--accent-color)' : '#33aaff',
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      margin: '0.3rem',
    },
    black_white_photo: {
      width: '2rem',
      height: '2rem',
      background: '#333',
      border: '1px solid #fff',
      borderRadius: '0.2rem',
      margin: '0.3rem',
    },

    // 1965 elements
    beatles_poster: {
      width: '3rem',
      height: '3rem',
      background: currentEra === '1965' ? 'var(--accent-color)' : '#33aaff',
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      margin: '0.3rem',
    },
    psychedelic_flyer: {
      width: '2.5rem',
      height: '2.5rem',
      background: '#ff44cc',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
    civil_rights_imagery: {
      width: '2.5rem',
      height: '2.5rem',
      background: '#333',
      color: '#fff',
      fontSize: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0.3rem',
    },
    soda_ad: {
      width: '2rem',
      height: '2rem',
      background: '#ff6b6b',
      borderRadius: '0.2rem',
      margin: '0.3rem',
    },
    mid_century_abstract: {
      width: '3rem',
      height: '3rem',
      background:
        currentEra === '1965'
          ? 'linear-gradient(135deg, #667eea, #764ba2)'
          : '#667eea',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },

    // 1985 elements
    mtv_logo: {
      width: '3rem',
      height: '3rem',
      background: currentEra === '1985' ? 'var(--accent-color)' : '#33aaff',
      backgroundSize: 'contain',
      backgroundRepeat: 'no-repeat',
      margin: '0.3rem',
    },
    synthwave_poster: {
      width: '2.5rem',
      height: '2.5rem',
      background:
        currentEra === '1985' ? 'linear-gradient(135deg, #ff00ff, #00ffff)' : '#ff00ff',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
    reagan_poster: {
      width: '2.5rem',
      height: '2.5rem',
      background: '#ff6b6b',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
    arcade_game_ad: {
      width: '2.5rem',
      height: '2.5rem',
      background: '#333',
      border: '2px solid #fff',
      borderRadius: '0.2rem',
      margin: '0.3rem',
    },
    neon_band_poster: {
      width: '3rem',
      height: '3rem',
      background:
        currentEra === '1985' ? 'linear-gradient(135deg, #00ff88, #00ccff)' : '#00ff88',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },

    // 2005 elements
    indie_gig_poster: {
      width: '3rem',
      height: '3rem',
      background: '#333',
      border: '1px dashed #fff',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
    starbucks_branding: {
      width: '3rem',
      height: '3rem',
      background: 'green',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
    smartphone_ad: {
      width: '2.5rem',
      height: '2.5rem',
      background: '#333',
      borderRadius: '0.2rem',
      margin: '0.3rem',
    },
    harry_potter_decor: {
      width: '2.5rem',
      height: '2.5rem',
      background: '#666',
      borderRadius: '0.2rem',
      margin: '0.3rem',
    },
    polaroid_wall: {
      width: '2rem',
      height: '2.5rem',
      background: '#333',
      border: '1px solid #fff',
      borderRadius: '0.2rem',
      margin: '0.3rem',
    },

    // 2025 elements
    minimalist_art_print: {
      width: '3rem',
      height: '3.5rem',
      background: '#f5f5f5',
      border: '1px solid #ddd',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
    eco_messaging: {
      width: '2.5rem',
      height: '2.5rem',
      background: '#2ecc71',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
    coffee_origin_map: {
      width: '3rem',
      height: '3rem',
      background: '#33aaff',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
    instagram_aesthetic: {
      width: '2.5rem',
      height: '2.5rem',
      background: '#f5f5f5',
      border: '1px solid #ddd',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
    digital_screen: {
      width: '3rem',
      height: '3rem',
      background: '#111',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
    qr_code_art: {
      width: '2.5rem',
      height: '2.5rem',
      background: '#333',
      borderRadius: '0.3rem',
      margin: '0.3rem',
    },
  };

  return (
    <div
      className="wall-decor"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Background wall texture */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background:
            currentEra === '2025'
              ? '#f5f5f5'
              : currentEra === '1945'
              ? '#f0e6dc'
              : currentEra === '1965'
              ? '#ff44cc'
              : currentEra === '1985'
              ? '#00ff00'
              : '#e0e0e0',
          opacity: 0.9,
        }}
      />

      {/* Posters using Html overlay for text-heavy ads - positioned on walls */}
      {decor.posterAds.map((ad, index) => (
        <Html
          key={ad.text}
          position={getPosition(ad.position)}
          size={0.8}
          align="center"
          baseline="middle"
        >
          <div
            style={{
              padding: '0.2rem 0.4rem',
              borderRadius: '0.3rem',
              fontFamily: getFontForEra(currentEra),
              fontSize: '0.6vw',
              textAlign: 'center',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              textShadow: '0 0 3px rgba(0,0,0,0.8)',
              width: '80px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {ad.text}
          </div>
        </Html>
      ))}

      {/* Decorative elements */}
      {decor.decorativeElements.map((element, index) => (
        <div
          key={element}
          className="decorative-element"
          style={elementStyles[element as keyof typeof elementStyles] || {}}
        />
      ))}

      {/* Canvas texture overlays for art prints */}
      {decor.canvasTextureDescriptions.map((desc, idx) => (
        <div
          key={idx}
          className="canvas-texture"
          style={{
            position: 'absolute',
            width: '200px',
            height: '300px',
            backgroundColor: getTextureColor(desc),
            borderRadius: '0.3rem',
            margin: '0.5rem',
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
};

// Helper to get position based on wall side
function getPosition(side: 'left' | 'center' | 'right'): [number, number, number] {
  const xPositions = { left: -2, center: 0, right: 2 };
  return [xPositions[side], 1.5, -3];
}

// Helper to get font family for era-appropriate typography
function getFontForEra(era: EraId): string {
  const fonts: Record<EraId, string> = {
    '1945': 'serif',
    '1965': 'cursive',
    '1985': 'futura',
    '2005': 'helvetica',
    '2025': 'inter',
  };
  return fonts[era] || 'serif';
}

// Helper to get texture color based on description
function getTextureColor(desc: string): string {
  const colors: Record<string, string> = {
    'canvas-texture-grunge-white': '#f5f5f5',
    'canvas-texture-parchment-old': '#f0e6dc',
    'canvas-texture-psychedelic': '#ff44cc',
    'canvas-texture-pop-art': '#ff6b6b',
    'canvas-texture-neon': '#00ff00',
    'canvas-texture-grid': '#00ffff',
    'canvas-texture-digital': '#e0e0e0',
    'canvas-texture-grid-paper': '#f8f9fa',
    'canvas-texture-smooth-white': '#ffffff',
    'canvas-texture-minimalist': '#fafafa',
  };
  return colors[desc] || '#eee';
}

WallDecor.displayName = 'WallDecor';