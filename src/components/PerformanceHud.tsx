import { useEffect, useRef, useState } from 'react';
import { rendererHolder } from '../store/renderer';

/**
 * Lightweight performance HUD overlay.
 *
 * Reads the active WebGLRenderer's info counters (draw calls, triangles,
 * geometry / texture memory) and shows a rolling FPS figure in a corner.
 * Hidden by default; enable with `?perf=1` in the URL or press Shift+P to
 * toggle. Zero-dependency and mounted outside the Canvas so it has no effect
 * on the render loop when hidden.
 */
export function PerformanceHud() {
  const [visible, setVisible] = useState(false);
  const [fps, setFps] = useState(0);
  const [calls, setCalls] = useState(0);
  const [tris, setTris] = useState(0);
  const [geoms, setGeoms] = useState(0);
  const [textures, setTextures] = useState(0);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    // Show if the URL carries ?perf=1 or the user previously opted in.
    const show =
      new URLSearchParams(window.location.search).has('perf') ||
      localStorage.getItem('perf-hud') === '1';
    setVisible(show);
  }, []);

  // FPS counter (own rAF, decoupled from the render loop).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = performance.now();
      const delta = now - lastTimeRef.current;
      if (delta >= 500) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      frameCountRef.current += 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Draw-call / memory readout while visible.
  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const gl = rendererHolder.gl;
      if (!gl) return;
      setCalls(gl.info.render.calls);
      setTris(gl.info.render.triangles);
      setGeoms(gl.info.memory.geometries);
      setTextures(gl.info.memory.textures);
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [visible]);

  // Toggle with Shift+P (persisted) or Alt+H (temporary).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'p') {
        const next = !visible;
        setVisible(next);
        localStorage.setItem('perf-hud', String(next));
      } else if (e.altKey && e.key.toLowerCase() === 'h') {
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    bottom: 10,
    left: 10,
    padding: '6px 10px',
    background: 'rgba(0,0,0,0.65)',
    color: '#00ff88',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 1.5,
    borderRadius: 4,
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    zIndex: 1000,
    pointerEvents: 'none',
  };

  return (
    <div style={style}>
      <div>FPS: {fps}</div>
      <div>Calls: {calls}</div>
      <div>Tris: {tris.toLocaleString()}</div>
      <div>Geometries: {geoms}</div>
      <div>Textures: {textures}</div>
      <div style={{ fontSize: 9, opacity: 0.6, marginTop: 2 }}>Shift+P hide</div>
    </div>
  );
}