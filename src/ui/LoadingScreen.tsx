import { useState, useEffect } from 'react';
import { useStore } from '../state';

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const setLoaded = useStore((s) => s.setLoaded);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 95) {
          clearInterval(interval);
          return p;
        }
        return p + Math.random() * 15 + 5;
      });
    }, 200);

    const timer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setLoaded(true), 300);
    }, 2400);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [setLoaded]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a2e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        fontFamily: "'Orbitron', sans-serif",
      }}
    >
      <h1
        style={{
          color: '#fff',
          fontSize: 'clamp(1.5rem, 4vw, 3rem)',
          fontWeight: 900,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '2rem',
          textShadow: '0 0 30px rgba(100, 180, 255, 0.5)',
        }}
      >
        City Timelapse
      </h1>
      <p
        style={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '0.9rem',
          marginBottom: '3rem',
          letterSpacing: '0.3em',
        }}
      >
        1945 — 2055
      </p>
      <div
        style={{
          width: '300px',
          height: '3px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(progress, 100)}%`,
            background: 'linear-gradient(90deg, #4a90d9, #00ced1)',
            borderRadius: '2px',
            transition: 'width 0.3s ease',
            boxShadow: '0 0 10px rgba(0, 206, 209, 0.5)',
          }}
        />
      </div>
      <p
        style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.75rem',
          marginTop: '1rem',
          letterSpacing: '0.2em',
        }}
      >
        {Math.min(Math.round(progress), 100)}%
      </p>
    </div>
  );
}
