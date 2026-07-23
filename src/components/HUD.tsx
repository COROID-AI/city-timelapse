import React from 'react'
import { TimelineSlider } from './TimelineSlider'
import { useAppStore } from '../app/store'

export function HUD() {
  const { sfxEnabled, reduceMotion, setSfxEnabled, setReduceMotion } = useAppStore()

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
      <div className="mx-auto max-w-6xl px-4 pt-4 pointer-events-auto">
        <div className="flex flex-col items-stretch gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/35 backdrop-blur">
            <div className="p-4">
              <TimelineSlider />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-white/85">
                    <input
                      type="checkbox"
                      checked={sfxEnabled}
                      onChange={(e) => setSfxEnabled(e.target.checked)}
                    />
                    SFX
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/85">
                    <input
                      type="checkbox"
                      checked={reduceMotion}
                      onChange={(e) => setReduceMotion(e.target.checked)}
                    />
                    Reduced motion
                  </label>
                </div>
                <div className="text-xs text-white/60">Drag to orbit · Scroll to zoom</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
