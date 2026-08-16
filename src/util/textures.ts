import * as THREE from 'three';
import type { EraId } from '../eras.js';

/** Canvas-based texture factory — every texture is generated at runtime */
export class TextureFactory {
  private readonly _cache = new Map<string, THREE.CanvasTexture>();

  /** Resolve a cached or freshly-generated texture */
  private getOrCreate(key: string, generator: () => HTMLCanvasElement): THREE.CanvasTexture {
    let tex = this._cache.get(key);
    if (!tex) {
      const canvas = generator();
      tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      this._cache.set(key, tex);
    }
    return tex;
  }

  // ── Material textures ─────────────────────────────────────────────

  createBrick(size = 256): THREE.CanvasTexture {
    return this.getOrCreate(`brick_${size}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Base red brick color
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(0, 0, size, size);

      const brickH = size / 8;
      const brickW = size / 4;
      const mortarColor = '#c2b280';

      for (let row = 0; row < 8; row++) {
        const offset = row % 2 === 0 ? 0 : brickW / 2;
        for (let col = -1; col < 5; col++) {
          const x = col * brickW + offset;
          const y = row * brickH;
          // Mortar
          ctx.fillStyle = mortarColor;
          ctx.fillRect(x, y, brickW, brickH);
          // Brick face (slightly varied red)
          const r = 120 + Math.random() * 40;
          const g = 40 + Math.random() * 20;
          const b = 10 + Math.random() * 15;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4);
        }
      }
      return canvas;
    });
  }

  createConcrete(size = 256): THREE.CanvasTexture {
    return this.getOrCreate(`concrete_${size}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#9e9e9e';
      ctx.fillRect(0, 0, size, size);

      // Add noise grain
      const imageData = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 30;
        imageData.data[i] += noise;
        imageData.data[i + 1] += noise;
        imageData.data[i + 2] += noise;
      }
      ctx.putImageData(imageData, 0, 0);

      // Panel seams
      ctx.strokeStyle = '#7a7a7a';
      ctx.lineWidth = 2;
      const seamSize = size / 4;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * seamSize, 0);
        ctx.lineTo(i * seamSize, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * seamSize);
        ctx.lineTo(size, i * seamSize);
        ctx.stroke();
      }
      return canvas;
    });
  }

  createGlass(size = 256): THREE.CanvasTexture {
    return this.getOrCreate(`glass_${size}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Gradient blue glass
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#4a90d9');
      grad.addColorStop(0.5, '#6ab0f3');
      grad.addColorStop(1, '#3a7bc8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Reflection streaks
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const x = Math.random() * size;
        const w = 2 + Math.random() * 20;
        ctx.fillRect(x, 0, w, size);
      }
      ctx.globalAlpha = 1.0;

      // Window grid
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      const gridSize = size / 8;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(size, i * gridSize);
        ctx.stroke();
      }
      return canvas;
    });
  }

  createWood(size = 256): THREE.CanvasTexture {
    return this.getOrCreate(`wood_${size}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#8B6914';
      ctx.fillRect(0, 0, size, size);

      // Wood grain lines
      ctx.strokeStyle = 'rgba(60,30,0,0.3)';
      ctx.lineWidth = 1;
      for (let y = 0; y < size; y += 3) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < size; x += 10) {
          ctx.lineTo(x, y + Math.sin(x * 0.05) * 2);
        }
        ctx.stroke();
      }

      // Knots
      for (let k = 0; k < 3; k++) {
        const kx = Math.random() * size;
        const ky = Math.random() * size;
        const kr = 5 + Math.random() * 10;
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(40,20,0,0.4)';
        ctx.fill();
      }
      return canvas;
    });
  }

  createPlaster(size = 256): THREE.CanvasTexture {
    return this.getOrCreate(`plaster_${size}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#f5f0e1';
      ctx.fillRect(0, 0, size, size);

      // Subtle noise
      const imageData = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 15;
        imageData.data[i] += noise;
        imageData.data[i + 1] += noise;
        imageData.data[i + 2] += noise;
      }
      ctx.putImageData(imageData, 0, 0);
      return canvas;
    });
  }

  createAsphalt(size = 256): THREE.CanvasTexture {
    return this.getOrCreate(`asphalt_${size}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(0, 0, size, size);

      // Aggregate noise
      const imageData = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 40;
        imageData.data[i] += noise;
        imageData.data[i + 1] += noise;
        imageData.data[i + 2] += noise;
      }
      ctx.putImageData(imageData, 0, 0);

      // Small stones
      for (let s = 0; s < 80; s++) {
        const sx = Math.random() * size;
        const sy = Math.random() * size;
        const sr = 1 + Math.random() * 3;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${80 + Math.random() * 40},${70 + Math.random() * 30},${60 + Math.random() * 20},0.5)`;
        ctx.fill();
      }
      return canvas;
    });
  }

  // ── Era-aware text-sign generation ────────────────────────────────

  /**
   * Generate a canvas texture for an era-specific storefront / billboard sign.
   * Uses period-appropriate typefaces, colors, and palettes.
   */
  createTextSign(text: string, eraId: EraId, width = 512, height = 128): THREE.CanvasTexture {
    return this.getOrCreate(`sign_${text}_${eraId}_${width}x${height}`, () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // Per-era palette & font config
      const eraConfig: Record<EraId, { bg: string; fg: string; font: string; glow?: boolean }> = {
        '1945': { bg: '#2a1f14', fg: '#f0e6c8', font: 'Georgia, serif' },
        '1965': { bg: '#ff6b35', fg: '#ffffff', font: '"Arial Black", Impact, sans-serif', glow: true },
        '1985': { bg: '#1a0a2e', fg: '#ff00ff', font: '"Courier New", monospace', glow: true },
        '2005': { bg: '#0066cc', fg: '#ffffff', font: 'Verdana, Arial, sans-serif' },
        '2025': { bg: '#0a0a0a', fg: '#00ff88', font: '"Helvetica Neue", Arial, sans-serif' },
      };

      const cfg = eraConfig[eraId];

      // Background
      ctx.fillStyle = cfg.bg;
      ctx.fillRect(0, 0, width, height);

      // Neon glow effect for applicable eras
      if (cfg.glow) {
        ctx.shadowColor = cfg.fg;
        ctx.shadowBlur = 15;
      }

      // Text
      ctx.fillStyle = cfg.fg;
      ctx.font = `bold ${Math.floor(height * 0.45)}px ${cfg.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, height / 2);

      // Reset shadow
      ctx.shadowBlur = 0;

      // Border
      ctx.strokeStyle = cfg.fg;
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, width - 8, height - 8);

      return canvas;
    });
  }
}
