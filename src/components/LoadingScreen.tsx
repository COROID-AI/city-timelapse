import React, { useEffect, useState } from 'react'

export function LoadingScreen() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let raf = 0
    let start = performance.now()
    const tick = () => {
      const t = performance.now() - start
      // Ease to 90 quickly; then wait a bit for scene readiness.
      const p = Math.min(90, Math.round((t / 900) * 90))
      setProgress((prev) => (p > prev ? p : prev))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const doneTimer = window.setTimeout(() => setProgress(100), 1100)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(doneTimer)
    }
  }, [])

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black">
      <div className="w-[420px] rounded-2xl border border-white/10 bg-white/5 p-6 text-white">
        <div className="text-lg font-semibold">Loading city…</div>
        <div className="mt-4 h-3 rounded-full bg-white/10">
          <div
            className="h-3 rounded-full bg-cyan-300/80"
            style={{ width: `${progress}%`, transition: 'width 180ms ease-out' }}
          />
        </div>
        <div className="mt-3 text-sm text-white/70">{progress}%</div>
      </div>
    </div>
  )
}
