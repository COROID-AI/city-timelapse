import * as THREE from 'three';
import type { EraId } from '../eras.js';

// ── Canvas-based ad texture generators — all invented generic brands ─

interface AdConfig {
  /** Main headline text */
  headline: string;
  /** Sub-headline or tagline */
  subtext: string;
  /** Background color */
  bg: string;
  /** Primary text color */
  fg: string;
  /** Accent color */
  accent?: string;
  /** Whether to draw decorative elements */
  drawDecorations?: (ctx: CanvasRenderingContext2D, _w: number, h: number) => void;
}

const AD_CONFIGS: Record<EraId, AdConfig[]> = {
  '1945': [
    {
      headline: 'BUY WAR BONDS',
      subtext: 'Help Win The War',
      bg: '#8B0000',
      fg: '#f0e6c8',
      accent: '#ffcc00',
      drawDecorations: (ctx, _w, h) => {
        // Stars pattern
        ctx.fillStyle = '#ffcc00';
        for (let i = 0; i < 8; i++) {
          const x = Math.random() * _w;
          const y = Math.random() * h;
          drawStar(ctx, x, y, 4, 8);
        }
      },
    },
    {
      headline: 'VICTORY GARDEN',
      subtext: 'Grow Your Own Vegetables',
      bg: '#2a4a2a',
      fg: '#f0e6c8',
      accent: '#66aa44',
      drawDecorations: (ctx, _w, h) => {
        // Leaf motifs
        ctx.fillStyle = '#66aa44';
        for (let i = 0; i < 5; i++) {
          const x = Math.random() * _w;
          const y = Math.random() * h;
          ctx.beginPath();
          ctx.ellipse(x, y, 12, 6, Math.random() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    },
    {
      headline: 'RAISON STATION',
      subtext: 'Submit Your Coupons Here',
      bg: '#4a3a2a',
      fg: '#f0e6c8',
      accent: '#8B4513',
    },
  ],
  '1965': [
    {
      headline: 'SMOKE FREEWINDS',
      subtext: 'They\'re Mild & Delicious',
      bg: '#ffffff',
      fg: '#222222',
      accent: '#ff6b35',
      drawDecorations: (ctx, _w, h) => {
        // Mid-century illustration style smoke swirls
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          const startX = 20 + i * 40;
          ctx.moveTo(startX, h);
          for (let y = h; y > 0; y -= 5) {
            ctx.lineTo(startX + Math.sin(y * 0.05) * 15, y);
          }
          ctx.stroke();
        }
      },
    },
    {
      headline: 'FIZZ POP SODA',
      subtext: 'The Refreshing Taste of Tomorrow',
      bg: '#0066cc',
      fg: '#ffffff',
      accent: '#ffcc00',
      drawDecorations: (ctx, _w, h) => {
        // Bubble pattern
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 20; i++) {
          ctx.beginPath();
          ctx.arc(Math.random() * _w, Math.random() * h, 3 + Math.random() * 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    },
    {
      headline: 'WATCH COLORVISION TV',
      subtext: 'Bringing Color Into Every Home',
      bg: '#1a1a2e',
      fg: '#ff6b35',
      accent: '#00ccff',
      drawDecorations: (ctx, _w, h) => {
        // Retro TV set outline
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 3;
        ctx.strokeRect(_w * 0.3, h * 0.2, _w * 0.4, h * 0.5);
        // Legs
        ctx.beginPath();
        ctx.moveTo(_w * 0.35, h * 0.7);
        ctx.lineTo(_w * 0.3, h * 0.85);
        ctx.moveTo(_w * 0.65, h * 0.7);
        ctx.lineTo(_w * 0.7, h * 0.85);
        ctx.stroke();
      },
    },
  ],
  '1985': [
    {
      headline: 'TAPE IT! VHS',
      subtext: 'Record Hits While You Sleep',
      bg: '#1a0a2e',
      fg: '#ff00ff',
      accent: '#00ffff',
      drawDecorations: (ctx, _w, h) => {
        // Cassette tape illustration
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(_w * 0.2, h * 0.3, _w * 0.6, h * 0.4);
        // Reels
        ctx.fillStyle = '#1a0a2e';
        ctx.beginPath();
        ctx.arc(_w * 0.35, h * 0.5, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(_w * 0.65, h * 0.5, 15, 0, Math.PI * 2);
        ctx.fill();
        // Scanlines
        ctx.globalAlpha = 0.1;
        for (let y = 0; y < h; y += 3) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, y, _w, 1);
        }
        ctx.globalAlpha = 1;
      },
    },
    {
      headline: 'CRYSTAL COLA',
      subtext: 'Taste The Thunder',
      bg: '#cc0000',
      fg: '#ffffff',
      accent: '#ffcc00',
      drawDecorations: (ctx, _w, h) => {
        // Lightning bolt
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(_w * 0.5, h * 0.1);
        ctx.lineTo(_w * 0.4, h * 0.4);
        ctx.lineTo(_w * 0.55, h * 0.4);
        ctx.lineTo(_w * 0.45, h * 0.9);
        ctx.lineTo(_w * 0.6, h * 0.5);
        ctx.lineTo(_w * 0.45, h * 0.5);
        ctx.closePath();
        ctx.fill();
      },
    },
    {
      headline: 'MAXIMUM SOUND CASSETTES',
      subtext: 'Hi-Fi Stereo Experience',
      bg: '#000000',
      fg: '#00ff00',
      accent: '#ff00ff',
      drawDecorations: (ctx, _w, h) => {
        // Audio waveform bars
        ctx.fillStyle = '#00ff00';
        for (let x = 10; x < _w - 10; x += 6) {
          const barH = 5 + Math.random() * 40;
          ctx.fillRect(x, h / 2 - barH / 2, 3, barH);
        }
      },
    },
  ],
  '2005': [
    {
      headline: 'NETZONE INTERNET',
      subtext: 'Browse Without Limits!',
      bg: '#0066cc',
      fg: '#ffffff',
      accent: '#00ccff',
      drawDecorations: (ctx, _w, h) => {
        // Globe icon
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(_w * 0.5, h * 0.4, 25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(_w * 0.5, h * 0.4, 25, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(_w * 0.5, h * 0.4, 10, 25, 0, 0, Math.PI * 2);
        ctx.stroke();
      },
    },
    {
      headline: 'RINGTONE MADNESS',
      subtext: 'Download Your Favorite Hits!',
      bg: '#cc00ff',
      fg: '#ffffff',
      accent: '#ffcc00',
      drawDecorations: (ctx, _w, h) => {
        // Musical notes
        ctx.fillStyle = '#ffcc00';
        for (let i = 0; i < 4; i++) {
          const x = 20 + i * 35;
          const y = h * 0.6 + Math.sin(i) * 20;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(x + 4, y - 20, 2, 20);
        }
      },
    },
    {
      headline: 'CONNECTME SOCIAL',
      subtext: 'Meet New Friends Online!',
      bg: '#336699',
      fg: '#ffffff',
      accent: '#66bbff',
      drawDecorations: (ctx, _w, h) => {
        // Connection nodes
        ctx.fillStyle = '#66bbff';
        const nodes = [[_w * 0.3, h * 0.3], [_w * 0.7, h * 0.3], [_w * 0.5, h * 0.6]];
        nodes.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.strokeStyle = '#66bbff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(nodes[0][0], nodes[0][1]);
        ctx.lineTo(nodes[1][0], nodes[1][1]);
        ctx.lineTo(nodes[2][0], nodes[2][1]);
        ctx.closePath();
        ctx.stroke();
      },
    },
  ],
  '2025': [
    {
      headline: 'SCAN & SAVE',
      subtext: 'QR Code Deals At Your Fingertips',
      bg: '#0a0a0a',
      fg: '#00ff88',
      accent: '#00ddff',
      drawDecorations: (ctx, _w, h) => {
        // QR code pattern
        ctx.fillStyle = '#00ff88';
        const qrSize = 8;
        const gridSize = 10;
        for (let row = 0; row < gridSize; row++) {
          for (let col = 0; col < gridSize; col++) {
            if (Math.random() > 0.4) {
              ctx.fillRect(
                _w * 0.15 + col * qrSize,
                h * 0.25 + row * qrSize,
                qrSize - 1,
                qrSize - 1,
              );
            }
          }
        }
        // Corner markers
        ctx.fillStyle = '#00ddff';
        [[_w * 0.15, h * 0.25], [_w * 0.15 + 7 * qrSize, h * 0.25], [_w * 0.15, h * 0.25 + 7 * qrSize]].forEach(
          ([x, y]) => {
            ctx.fillRect(x, y, 8 * qrSize, 8 * qrSize);
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(x + 2, y + 2, 6 * qrSize, 6 * qrSize);
            ctx.fillStyle = '#00ddff';
            ctx.fillRect(x + 3 * qrSize, y + 3 * qrSize, 2 * qrSize, 2 * qrSize);
          },
        );
      },
    },
    {
      headline: 'ECOGREEN LIVING',
      subtext: 'Sustainable Products For A Better Tomorrow',
      bg: '#1a2a1a',
      fg: '#00ff88',
      accent: '#88cc44',
      drawDecorations: (ctx, _w, h) => {
        // Leaf/sustainability icon
        ctx.fillStyle = '#88cc44';
        ctx.beginPath();
        ctx.ellipse(_w * 0.5, h * 0.4, 20, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        // Stem
        ctx.strokeStyle = '#88cc44';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(_w * 0.5, h * 0.4 + 30);
        ctx.lineTo(_w * 0.5, h * 0.7);
        ctx.stroke();
      },
    },
    {
      headline: 'STREAMANY NOW',
      subtext: 'All Your Favorites In One Place',
      bg: '#0a0a1a',
      fg: '#ff0066',
      accent: '#00ccff',
      drawDecorations: (ctx, _w, h) => {
        // Play button triangle
        ctx.fillStyle = '#ff0066';
        ctx.beginPath();
        ctx.moveTo(_w * 0.42, h * 0.25);
        ctx.lineTo(_w * 0.42, h * 0.75);
        ctx.lineTo(_w * 0.65, h * 0.5);
        ctx.closePath();
        ctx.fill();
        // Gradient overlay
        const grad = ctx.createLinearGradient(0, 0, _w, h);
        grad.addColorStop(0, 'rgba(0,204,255,0.2)');
        grad.addColorStop(1, 'rgba(255,0,102,0.2)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, _w, h);
      },
    },
  ],
};

/** Draw a small star shape on canvas */
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, innerR: number, outerR: number): void {
  const spikes = 5;
  const step = Math.PI / spikes;
  ctx.beginPath();
  for (let i = 0; i < 2 * spikes; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = i * step - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Generate a canvas texture for an era-appropriate advertisement poster.
 */
export function createAdTexture(adIndex: number, eraId: EraId, width = 512, height = 384): THREE.CanvasTexture {
  const configs = AD_CONFIGS[eraId];
  const config = configs[Math.min(adIndex, configs.length - 1)] || configs[0];

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = config.bg;
  ctx.fillRect(0, 0, width, height);

  // Decorative elements
  if (config.drawDecorations) {
    config.drawDecorations(ctx, width, height);
  }

  // Neon glow for applicable eras
  if (eraId === '1985' || eraId === '2025') {
    ctx.shadowColor = config.accent || config.fg;
    ctx.shadowBlur = 12;
  }

  // Headline
  ctx.fillStyle = config.fg;
  ctx.font = `bold ${Math.floor(height * 0.12)}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(config.headline, width / 2, height * 0.35);

  // Reset shadow for subtext
  ctx.shadowBlur = 0;

  // Subtext
  ctx.font = `${Math.floor(height * 0.06)}px Verdana, Arial, sans-serif`;
  ctx.fillStyle = config.accent || config.fg;
  ctx.globalAlpha = 0.9;
  ctx.fillText(config.subtext, width / 2, height * 0.55);
  ctx.globalAlpha = 1;

  // Era-specific border treatment
  switch (eraId) {
    case '1945': {
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, width - 16, height - 16);
      ctx.strokeStyle = '#f0e6c8';
      ctx.lineWidth = 2;
      ctx.strokeRect(14, 14, width - 28, height - 28);
      break;
    }
    case '1965': {
      // Rounded corners
      const radius = 16;
      ctx.strokeStyle = config.accent || '#ff6b35';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(6, 6, width - 12, height - 12, radius);
      ctx.stroke();
      break;
    }
    case '1985': {
      // Angled neon border
      ctx.strokeStyle = config.accent || '#00ffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, width - 8, height - 8);
      ctx.strokeStyle = config.fg;
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 8, width - 16, height - 16);
      break;
    }
    case '2005': {
      // Glossy gradient overlay
      const gloss = ctx.createLinearGradient(0, 0, 0, height);
      gloss.addColorStop(0, 'rgba(255,255,255,0.15)');
      gloss.addColorStop(0.5, 'rgba(255,255,255,0)');
      gloss.addColorStop(1, 'rgba(0,0,0,0.1)');
      ctx.fillStyle = gloss;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case '2025': {
      // Minimalist thin border
      ctx.strokeStyle = config.accent || '#00ddff';
      ctx.lineWidth = 1;
      ctx.strokeRect(2, 2, width - 4, height - 4);
      break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Build a billboard mesh with era-appropriate ad texture.
 * Positioned high on building facades for maximum visibility.
 */
export function buildBillboard(
  adIndex: number,
  eraId: EraId,
  width = 5,
  height = 3.5,
): THREE.Mesh {
  const texture = createAdTexture(adIndex, eraId, 512, 384);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: eraId === '1985' ? 0.6 : eraId === '2025' ? 0.3 : 0.15,
    roughness: 0.7,
    metalness: 0.05,
  });

  return new THREE.Mesh(geo, mat);
}

/**
 * Build a painted wall ad — smaller, ground-level advertising panel.
 */
export function buildWallAd(
  adIndex: number,
  eraId: EraId,
  width = 2.5,
  height = 1.8,
): THREE.Mesh {
  const texture = createAdTexture(adIndex, eraId, 512, 384);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(width, height);

  let mat: THREE.Material;
  if (eraId === '1945') {
    // Weathered painted look
    mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      metalness: 0.0,
    });
  } else if (eraId === '1985') {
    // Neon-glowing sign
    mat = new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color(0xff00ff),
      emissiveIntensity: 0.8,
      transparent: true,
      roughness: 0.3,
      metalness: 0.1,
    });
  } else {
    mat = new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.2,
      roughness: 0.6,
      metalness: 0.05,
    });
  }

  return new THREE.Mesh(geo, mat);
}

/**
 * Get the number of unique ad configurations for an era.
 */
export function getAdCount(eraId: EraId): number {
  return AD_CONFIGS[eraId]?.length || 0;
}
