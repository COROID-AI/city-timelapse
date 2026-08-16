import { fpsMonitor } from '../../scene/resources.js';

/**
 * Lightweight runtime FPS counter overlay.
 * Toggled with F key; displays current FPS, average FPS, min/max FPS.
 */
export class DebugFPSOverlay {
  private _container: HTMLDivElement;
  private _visible = false;
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D;

  constructor() {
    this._container = document.createElement('div');
    this._container.id = 'debug-fps-overlay';
    this._container.style.cssText = `
      position: fixed; top: 8px; right: 8px; z-index: 10000;
      font-family: monospace; font-size: 11px; color: #fff;
      background: rgba(0,0,0,0.7); border-radius: 4px; padding: 6px 8px;
      pointer-events: none; user-select: none; line-height: 1.4;
      display: none;
    `;

    this._canvas = document.createElement('canvas');
    this._canvas.width = 200;
    this._canvas.height = 60;
    this._canvas.style.width = '180px';
    this._canvas.style.height = '54px';
    this._canvas.style.display = 'block';
    this._ctx = this._canvas.getContext('2d')!;

    const title = document.createElement('div');
    title.textContent = '🎮 DEBUG FPS';
    title.style.cssText = 'font-weight:bold;margin-bottom:2px;color:#0f0;font-size:10px;';
    this._container.appendChild(title);
    this._container.appendChild(this._canvas);

    document.body.appendChild(this._container);
  }

  /** Toggle visibility. Returns new visibility state. */
  toggle(): boolean {
    this._visible = !this._visible;
    this._container.style.display = this._visible ? 'block' : 'none';
    return this._visible;
  }

  get isVisible(): boolean {
    return this._visible;
  }

  /**
   * Update the overlay with the latest FPS data.
   * Call this once per frame when visible.
   */
  update(fpsData: ReturnType<typeof fpsMonitor.tick>, drawCalls: number, triangles: number): void {
    if (!this._visible) return;

    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    // Clear
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, w, h);

    const fps = fpsData.current;
    const avg = fpsData.average;
    const min = fpsData.min;
    const max = fpsData.max;

    // Color based on performance tier
    let barColor = '#0f0'; // green — good
    if (fps < 20) barColor = '#f00'; // red — bad
    else if (fps < 35) barColor = '#fa0'; // orange — moderate

    // Draw FPS bar background
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(6, 14, w - 12, 8);

    // Draw FPS bar fill
    const barWidth = Math.min(w - 12, Math.max(0, (fps / 70) * (w - 12)));
    ctx.fillStyle = barColor;
    ctx.fillRect(6, 14, barWidth, 8);

    // Draw text lines
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${fps} FPS`, 6, 34);

    ctx.font = '9px monospace';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`avg:${avg} min:${min} max:${max}`, 6, 46);

    ctx.fillText(`draws:${drawCalls} tri:${triangles}`, 6, 57);
  }

  dispose(): void {
    this._container.remove();
  }
}
